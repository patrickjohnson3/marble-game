import { distance } from "./geometry.js";

export function getObjectiveRegion(map) {
  if (!map.objective) return map.goal ?? null;
  if (map.objective.type === "eliminate") return null;
  if (map.objective.type !== "reach") {
    throw new Error("Unknown objective type: " + map.objective.type);
  }

  const region = map.regions?.find(
    (candidate) => candidate.id === map.objective.region,
  );
  if (!region) {
    throw new Error("Unknown objective region: " + map.objective.region);
  }
  return region;
}

export function marbleInsideRegion(marble, region) {
  if (!region) return false;
  if (Number.isFinite(region.r)) {
    return distance(marble, region) + marble.r <= region.r;
  }
  return (
    marble.x - marble.r >= region.x &&
    marble.y - marble.r >= region.y &&
    marble.x + marble.r <= region.x + region.w &&
    marble.y + marble.r <= region.y + region.h
  );
}

export function livingAntCount(ants) {
  let remaining = 0;
  for (const ant of ants) {
    if (ant.alive) remaining++;
  }
  return remaining;
}

export function objectiveStatusText(map, remaining) {
  if (map.objective?.type === "eliminate") {
    return "Kill all ants · " + remaining + " left";
  }
  if (map.objective?.type === "reach") return "Reach the exit doorway";
  return "Hold inside the green goal";
}
