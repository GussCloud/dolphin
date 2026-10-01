using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

// Why hand-rolled: the launcher compiles with only csc's default references, which carry no JSON
// serializer. The writer emits ASCII-only JSON so every UTF-16 unit, lone surrogates included,
// round-trips through JSON.parse unchanged.
internal static class AgentTeamsPipeJson
{
    private const int MaxDepth = 16;

    public static void AppendString(StringBuilder json, string value)
    {
        json.Append('"');
        foreach (char character in value ?? "")
        {
            if (character == '"')
            {
                json.Append("\\\"");
            }
            else if (character == '\\')
            {
                json.Append("\\\\");
            }
            else if (character < ' ' || character > '~')
            {
                json.Append("\\u");
                json.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
            }
            else
            {
                json.Append(character);
            }
        }
        json.Append('"');
    }

    public static Dictionary<string, object> ParseObject(string text)
    {
        int index = 0;
        object value = ParseValue(text, ref index, 0);
        SkipWhitespace(text, ref index);
        Dictionary<string, object> result = value as Dictionary<string, object>;
        if (result == null || index != text.Length)
        {
            throw new FormatException("malformed response from Dolphin");
        }
        return result;
    }

    private static object ParseValue(string text, ref int index, int depth)
    {
        if (depth > MaxDepth)
        {
            throw new FormatException("response from Dolphin is nested too deeply");
        }
        SkipWhitespace(text, ref index);
        char next = Peek(text, index);
        if (next == '{')
        {
            return ParseObjectBody(text, ref index, depth);
        }
        if (next == '[')
        {
            return ParseArrayBody(text, ref index, depth);
        }
        if (next == '"')
        {
            return ParseString(text, ref index);
        }
        if (TryConsume(text, ref index, "true"))
        {
            return true;
        }
        if (TryConsume(text, ref index, "false"))
        {
            return false;
        }
        if (TryConsume(text, ref index, "null"))
        {
            return null;
        }
        return ParseNumber(text, ref index);
    }

    private static Dictionary<string, object> ParseObjectBody(string text, ref int index, int depth)
    {
        Dictionary<string, object> result = new Dictionary<string, object>(StringComparer.Ordinal);
        index += 1;
        SkipWhitespace(text, ref index);
        if (Peek(text, index) == '}')
        {
            index += 1;
            return result;
        }
        while (true)
        {
            SkipWhitespace(text, ref index);
            string key = ParseString(text, ref index);
            SkipWhitespace(text, ref index);
            Expect(text, ref index, ':');
            result[key] = ParseValue(text, ref index, depth + 1);
            SkipWhitespace(text, ref index);
            if (Peek(text, index) == ',')
            {
                index += 1;
                continue;
            }
            Expect(text, ref index, '}');
            return result;
        }
    }

    private static List<object> ParseArrayBody(string text, ref int index, int depth)
    {
        List<object> result = new List<object>();
        index += 1;
        SkipWhitespace(text, ref index);
        if (Peek(text, index) == ']')
        {
            index += 1;
            return result;
        }
        while (true)
        {
            result.Add(ParseValue(text, ref index, depth + 1));
            SkipWhitespace(text, ref index);
            if (Peek(text, index) == ',')
            {
                index += 1;
                continue;
            }
            Expect(text, ref index, ']');
            return result;
        }
    }

    private static string ParseString(string text, ref int index)
    {
        Expect(text, ref index, '"');
        StringBuilder value = new StringBuilder();
        while (true)
        {
            char character = Peek(text, index);
            index += 1;
            if (character == '"')
            {
                return value.ToString();
            }
            if (character < ' ')
            {
                throw new FormatException("malformed string in response from Dolphin");
            }
            if (character != '\\')
            {
                value.Append(character);
                continue;
            }
            char escape = Peek(text, index);
            index += 1;
            switch (escape)
            {
                case '"': value.Append('"'); break;
                case '\\': value.Append('\\'); break;
                case '/': value.Append('/'); break;
                case 'b': value.Append('\b'); break;
                case 'f': value.Append('\f'); break;
                case 'n': value.Append('\n'); break;
                case 'r': value.Append('\r'); break;
                case 't': value.Append('\t'); break;
                case 'u':
                    if (index + 4 > text.Length)
                    {
                        throw new FormatException("malformed escape in response from Dolphin");
                    }
                    value.Append((char)int.Parse(
                        text.Substring(index, 4),
                        NumberStyles.AllowHexSpecifier,
                        CultureInfo.InvariantCulture));
                    index += 4;
                    break;
                default:
                    throw new FormatException("malformed escape in response from Dolphin");
            }
        }
    }

    private static double ParseNumber(string text, ref int index)
    {
        int start = index;
        while (index < text.Length && "+-0123456789.eE".IndexOf(text[index]) >= 0)
        {
            index += 1;
        }
        double value;
        if (index == start || !double.TryParse(
            text.Substring(start, index - start),
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out value))
        {
            throw new FormatException("malformed value in response from Dolphin");
        }
        return value;
    }

    private static bool TryConsume(string text, ref int index, string literal)
    {
        if (string.CompareOrdinal(text, index, literal, 0, literal.Length) != 0)
        {
            return false;
        }
        index += literal.Length;
        return true;
    }

    private static void Expect(string text, ref int index, char expected)
    {
        if (Peek(text, index) != expected)
        {
            throw new FormatException("malformed response from Dolphin");
        }
        index += 1;
    }

    private static char Peek(string text, int index)
    {
        if (index >= text.Length)
        {
            throw new FormatException("truncated response from Dolphin");
        }
        return text[index];
    }

    private static void SkipWhitespace(string text, ref int index)
    {
        while (index < text.Length && (text[index] == ' ' || text[index] == '\t' || text[index] == '\n' || text[index] == '\r'))
        {
            index += 1;
        }
    }
}
