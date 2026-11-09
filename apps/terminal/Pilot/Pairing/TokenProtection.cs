using System.Security.Cryptography;
using System.Text;

namespace JobPilot.Terminal.Pilot.Pairing;

/// <summary>Wraps the pilot token with DPAPI on Windows; elsewhere pilot.json is 0600 plaintext.</summary>
internal static class TokenProtection
{
    public static (string Token, bool Protected) Protect(string token)
    {
        if (!OperatingSystem.IsWindows())
        {
            return (token, false);
        }

        var blob = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), optionalEntropy: null, DataProtectionScope.CurrentUser);
        return (Convert.ToBase64String(blob), true);
    }

    public static string? Unprotect(string stored, bool isProtected)
    {
        if (!isProtected)
        {
            return stored;
        }

        // A blob written on Windows is unreadable off Windows or under another user.
        if (!OperatingSystem.IsWindows())
        {
            return null;
        }

        try
        {
            var bytes = ProtectedData.Unprotect(Convert.FromBase64String(stored), optionalEntropy: null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            return null;
        }
    }
}
