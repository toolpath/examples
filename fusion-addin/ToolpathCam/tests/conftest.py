import sys
from unittest import mock

import pytest

# Fusion's API exists only inside Fusion; `lib` imports it at module level.
adsk = mock.MagicMock(name="adsk")
for name in ("core", "fusion", "cam"):
    sys.modules[f"adsk.{name}"] = getattr(adsk, name)
sys.modules["adsk"] = adsk


@pytest.fixture
def fusion():
    adsk.reset_mock(return_value=True, side_effect=True)
    adsk.core.Point3D.create.side_effect = lambda x, y, z: ("point", x, y, z)
    adsk.core.Vector3D.create.side_effect = lambda x, y, z: ("vector", x, y, z)
    return adsk
