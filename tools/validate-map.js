import { baseMapConfig } from "../core/map-config.js";
import { validateMapConfig } from "../core/map-validation.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { mapDefinitions } from "../maps/map-data.js";
import {
  authoredThemes,
  surfaceTypes,
  fixtureKinds,
  sceneryKinds,
  clusterKinds,
} from "../maps/map-authoring.js";

const requested = process.argv.slice(2);
if (requested.includes("--list")) {
  console.log(
    JSON.stringify(
      {
        maps: baseMapConfig.variants.map(({ id, objective }) => ({
          id,
          objective: objective ?? "legacy held goal",
        })),
        objectives: ["eliminate: ant/all", "reach: named rectangular region"],
        themes: authoredThemes,
        surfaces: surfaceTypes,
        fixtures: fixtureKinds,
        scenery: sceneryKinds,
        clusters: clusterKinds,
      },
      null,
      2,
    ),
  );
} else {
  const ids = requested.length ? requested : mapDefinitions.map(({ id }) => id);
  for (const id of ids) {
    if (!baseMapConfig.variants.some((map) => map.id === id)) {
      console.error(`Unknown map '${id}'. Use npm run map:validate -- --list.`);
      process.exitCode = 1;
      continue;
    }
    const map = resolveMapVariantConfig(baseMapConfig, id);
    const errors = validateMapConfig(map);
    if (errors.length) {
      console.error(
        `${id}:\n${errors.map((error) => "  - " + error).join("\n")}`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `${id}: valid; ${map.objective?.type ?? "held goal"}; ${map.elements.length} elements${map.route ? "; authored steering corridor checked" : ""}`,
      );
    }
  }
}
