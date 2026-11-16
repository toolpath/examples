import subprocess
import sys

import adsk.core

# Fusion has no enum member for "Match device theme"; it reports 4.
_MATCH_DEVICE = 4


def _system_is_dark() -> bool:
    try:
        if sys.platform == "darwin":
            result = subprocess.run(
                ["defaults", "read", "-g", "AppleInterfaceStyle"],
                capture_output=True,
                text=True,
            )
            return result.stdout.strip().lower() == "dark"
        if sys.platform == "win32":
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            )
            value, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
            winreg.CloseKey(key)
            return value == 0
    except Exception:
        pass
    return False


def get_theme() -> str:
    """ "dark" or "light", resolving Fusion's "Match device theme"."""
    try:
        theme = adsk.core.Application.get().preferences.generalPreferences.userInterfaceTheme
        if theme == adsk.core.UserInterfaceThemes.DarkBlueUserInterfaceTheme:
            return "dark"
        if theme == _MATCH_DEVICE:
            return "dark" if _system_is_dark() else "light"
    except Exception:
        pass
    return "light"
