using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;

// Why: sends one tmux call straight to Dolphin's agent-teams-only pipe
// (src/main/runtime/claude-agent-teams-pipe-listener.ts) instead of starting the Electron-as-Node CLI.
internal static class AgentTeamsTmuxPipeClient
{
    private const string EndpointEnv = "DOLPHIN_AGENT_TEAMS_ENDPOINT";
    private const string PipePrefix = @"\\.\pipe\";
    private const int ProtocolVersion = 1;
    private const int ConnectTimeoutMs = 500;
    // Why: split/respawn wait on the terminal daemon, which can be busy spawning another pane (10.4s seen).
    private const int ResponseTimeoutMs = 30000;
    private const int MaxResponseBytes = 64 * 1024 * 1024;
    private const string KeepaliveFrame = "{\"_keepalive\":true}";
    private static readonly Regex EndpointPattern = new Regex(
        @"\A\\\\\.\\pipe\\dolphin-agent-teams-[0-9]+-[0-9a-f]{32}\z",
        RegexOptions.CultureInvariant);

    /// <summary>False only when the caller should fall back to the CLI path: no usable endpoint, or no connection.</summary>
    public static bool TryRun(string[] argv, out int exitCode)
    {
        exitCode = 1;
        string endpoint = Environment.GetEnvironmentVariable(EndpointEnv);
        if (endpoint == null || !EndpointPattern.IsMatch(endpoint))
        {
            return false;
        }
        string requestId = Guid.NewGuid().ToString("N");
        byte[] request = Encoding.UTF8.GetBytes(BuildRequest(requestId, argv));
        using (NamedPipeClientStream pipe = new NamedPipeClientStream(
            ".",
            endpoint.Substring(PipePrefix.Length),
            PipeDirection.InOut,
            PipeOptions.Asynchronous,
            // Why: Dolphin's listener only needs to identify the caller, and the handle must not leak into children.
            TokenImpersonationLevel.Identification,
            HandleInheritability.None))
        {
            try
            {
                pipe.Connect(ConnectTimeoutMs);
            }
            catch (Exception)
            {
                return false;
            }
            // Why: once a byte may have reached Dolphin, never fall back — split-window and
            // respawn-pane are not idempotent, so a retry could open a second pane.
            try
            {
                pipe.Write(request, 0, request.Length);
                pipe.Flush();
                Dictionary<string, object> response = ReadResponse(pipe);
                string stdout = ReadField<string>(response, "stdout");
                string stderr = ReadField<string>(response, "stderr");
                int code = ReadExitCode(response);
                if (ReadField<string>(response, "id") != requestId)
                {
                    throw new IOException("response id does not match the request");
                }
                WriteUtf8(Console.OpenStandardOutput(), stdout);
                WriteUtf8(Console.OpenStandardError(), stderr);
                exitCode = code;
            }
            catch (Exception error)
            {
                WriteUtf8(Console.OpenStandardError(), "tmux: " + error.Message + "\n");
                exitCode = 1;
            }
            return true;
        }
    }

    public static void WriteUtf8(Stream stream, string text)
    {
        byte[] bytes = new UTF8Encoding(false).GetBytes(text);
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }

    private static string BuildRequest(string requestId, string[] argv)
    {
        StringBuilder json = new StringBuilder("{\"v\":1,\"id\":");
        AgentTeamsPipeJson.AppendString(json, requestId);
        AppendField(json, "teamId", Environment.GetEnvironmentVariable("DOLPHIN_AGENT_TEAMS_TEAM_ID"));
        AppendField(json, "token", Environment.GetEnvironmentVariable("DOLPHIN_AGENT_TEAMS_TOKEN"));
        AppendField(json, "envPane", Environment.GetEnvironmentVariable("TMUX_PANE"));
        AppendField(json, "cwd", Environment.CurrentDirectory);
        json.Append(",\"argv\":[");
        for (int index = 0; index < argv.Length; index += 1)
        {
            if (index > 0)
            {
                json.Append(',');
            }
            AgentTeamsPipeJson.AppendString(json, argv[index]);
        }
        json.Append("]}\n");
        return json.ToString();
    }

    private static void AppendField(StringBuilder json, string name, string value)
    {
        json.Append(",\"").Append(name).Append("\":");
        AgentTeamsPipeJson.AppendString(json, value);
    }

    private static Dictionary<string, object> ReadResponse(Stream pipe)
    {
        Stopwatch elapsed = Stopwatch.StartNew();
        MemoryStream line = new MemoryStream();
        byte[] buffer = new byte[64 * 1024];
        while (true)
        {
            long remaining = ResponseTimeoutMs - elapsed.ElapsedMilliseconds;
            IAsyncResult pending = pipe.BeginRead(buffer, 0, buffer.Length, null, null);
            if (remaining <= 0 || !pending.AsyncWaitHandle.WaitOne((int)Math.Max(remaining, 0)))
            {
                throw new TimeoutException("timed out waiting for Dolphin");
            }
            int read = pipe.EndRead(pending);
            if (read == 0)
            {
                throw new IOException("Dolphin closed the agent teams pipe without a response");
            }
            int start = 0;
            for (int index = 0; index < read; index += 1)
            {
                if (buffer[index] != (byte)'\n')
                {
                    continue;
                }
                line.Write(buffer, start, index - start);
                start = index + 1;
                string text = Encoding.UTF8.GetString(line.ToArray()).Trim();
                line.SetLength(0);
                if (text.Length == 0 || text == KeepaliveFrame)
                {
                    continue;
                }
                Dictionary<string, object> response = AgentTeamsPipeJson.ParseObject(text);
                object version;
                if (!response.TryGetValue("v", out version) || !(version is double) || (double)version != ProtocolVersion)
                {
                    throw new IOException("unsupported agent teams pipe protocol version");
                }
                return response;
            }
            line.Write(buffer, start, read - start);
            if (line.Length > MaxResponseBytes)
            {
                throw new IOException("response from Dolphin is too large");
            }
        }
    }

    private static T ReadField<T>(Dictionary<string, object> response, string name) where T : class
    {
        object value;
        T typed = response.TryGetValue(name, out value) ? value as T : null;
        if (typed == null)
        {
            throw new IOException("response from Dolphin is missing " + name);
        }
        return typed;
    }

    private static int ReadExitCode(Dictionary<string, object> response)
    {
        object value;
        if (!response.TryGetValue("exitCode", out value) || !(value is double))
        {
            throw new IOException("response from Dolphin is missing exitCode");
        }
        double code = (double)value;
        if (code != Math.Floor(code) || code < int.MinValue || code > int.MaxValue)
        {
            throw new IOException("response from Dolphin has an invalid exitCode");
        }
        return (int)code;
    }
}
