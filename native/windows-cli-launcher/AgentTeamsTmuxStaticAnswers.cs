using System;
using System.Collections.Generic;

// Why: these mirror ClaudeAgentTeamsTmuxDispatcher answers that never read team state, so tmux.exe
// answers them without reaching Dolphin. Keep both in step with
// src/main/runtime/claude-agent-teams-tmux-dispatcher.ts.
internal static class AgentTeamsTmuxStaticAnswers
{
    private static readonly HashSet<string> NoOpCommands = new HashSet<string>(StringComparer.Ordinal)
    {
        "set-option",
        "set",
        "set-window-option",
        "setw",
        "set-hook",
        "refresh-client",
        "has-session",
        "has",
        "resize-pane",
        "resizep",
        "attach-session",
        "detach-client",
        "source-file",
        "wait-for"
    };

    public static bool TryAnswer(string[] argv, out string stdout)
    {
        stdout = null;
        string command;
        List<string> args;
        if (!TrySplitCommand(argv, out command, out args))
        {
            return false;
        }
        if (command == "-V" || command == "-v")
        {
            stdout = "tmux 3.4\n";
            return true;
        }
        if (NoOpCommands.Contains(command))
        {
            stdout = "";
            return true;
        }
        if (command == "show-options" || command == "show-option" || command == "show")
        {
            return TryShowExtendedKeys(args, out stdout);
        }
        return false;
    }

    // Mirrors splitTmuxCommand in src/shared/claude-agent-teams-tmux-compat.ts.
    private static bool TrySplitCommand(string[] argv, out string command, out List<string> args)
    {
        command = null;
        args = null;
        for (int index = 0; index < argv.Length; index += 1)
        {
            string arg = argv[index] ?? "";
            if (arg == "--")
            {
                return false;
            }
            if (!arg.StartsWith("-", StringComparison.Ordinal) || arg == "-")
            {
                command = arg.ToLowerInvariant();
                args = new List<string>();
                for (int rest = index + 1; rest < argv.Length; rest += 1)
                {
                    args.Add(argv[rest] ?? "");
                }
                return true;
            }
            if (arg == "-V" || arg == "-v")
            {
                command = arg;
                args = new List<string>();
                return true;
            }
            if (arg == "-L" || arg == "-S" || arg == "-f")
            {
                index += 1;
            }
        }
        return false;
    }

    // Mirrors parseTmuxArgs(args, ['-t'], ['-g', '-q', '-s', '-v', '-w']) in the dispatcher's showOptions.
    private static bool TryShowExtendedKeys(List<string> args, out string stdout)
    {
        stdout = null;
        bool valueOnly = false;
        string lastPositional = "";
        bool pastTerminator = false;
        for (int index = 0; index < args.Count; index += 1)
        {
            string arg = args[index];
            if (pastTerminator)
            {
                lastPositional = arg;
                continue;
            }
            if (arg == "--")
            {
                pastTerminator = true;
                continue;
            }
            if (!arg.StartsWith("-", StringComparison.Ordinal) || arg == "-" || arg.StartsWith("--", StringComparison.Ordinal))
            {
                lastPositional = arg;
                continue;
            }
            string cluster = arg.Substring(1);
            bool recognized = false;
            for (int cursor = 0; cursor < cluster.Length; )
            {
                char flag = cluster[cursor];
                if ("gqsvw".IndexOf(flag) >= 0)
                {
                    valueOnly = valueOnly || flag == 'v';
                    cursor += 1;
                    recognized = true;
                    continue;
                }
                if (flag == 't')
                {
                    if (cursor + 1 >= cluster.Length)
                    {
                        index += 1;
                    }
                    recognized = true;
                    break;
                }
                recognized = false;
                break;
            }
            if (!recognized)
            {
                lastPositional = arg;
            }
        }
        if (lastPositional != "extended-keys")
        {
            return false;
        }
        stdout = valueOnly ? "on\n" : "extended-keys on\n";
        return true;
    }
}
