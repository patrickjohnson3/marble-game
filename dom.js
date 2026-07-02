import { domIds } from "./dom-ids.js";

function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error("Missing required DOM element #" + id);
  }
  return element;
}

export const els = Object.fromEntries(
  Object.entries(domIds).map(([key, id]) => [key, requiredElement(id)])
);
