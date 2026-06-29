"""Multi-agent coordinator for parallel execution."""
import asyncio
from typing import Dict, Any, Callable
from loguru import logger

class AgentCoordinator:
    """Coordinates multiple agents for parallel execution."""

    def __init__(self):
        self.agents: Dict[str, Callable] = {}
        self.memory: Dict[str, Any] = {}

    def register(self, name: str, agent_func: Callable):
        self.agents[name] = agent_func
        logger.info(f"Registered agent: {name}")

    async def execute_parallel(self, tasks: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Execute multiple agent tasks in parallel."""
        async_tasks = []
        for task in tasks:
            agent_name = task.get("agent")
            if agent_name not in self.agents:
                raise ValueError(f"Unknown agent: {agent_name}")
            async_tasks.append(self.agents[agent_name](task))

        results = await asyncio.gather(*async_tasks, return_exceptions=True)

        outputs = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                outputs.append({"error": str(result), "task": tasks[i]})
            else:
                outputs.append(result)
        return outputs

    def store_memory(self, key: str, value: Any):
        self.memory[key] = value

    def get_memory(self, key: str, default=None):
        return self.memory.get(key, default)
