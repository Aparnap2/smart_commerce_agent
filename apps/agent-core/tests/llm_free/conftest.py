"""Register llm_free fixtures for pytest discovery.

Fixtures defined in ``tests/llm_free/fixtures.py`` (e.g. ``mock_llm_env``,
``mock_llm_tools``) are registered here so pytest can discover them.
Without this file, pytest only discovers fixtures in ``conftest.py`` files.
"""

pytest_plugins = ["tests.llm_free.fixtures"]
