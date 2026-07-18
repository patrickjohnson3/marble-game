import { domIds } from "./dom-ids.js";

function requiredElement(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) {
    throw new Error("Missing required DOM element #" + id);
  }
  return element;
}

export function createDomElements(documentRef = document) {
  return Object.fromEntries(
    Object.entries(domIds).map(([key, id]) => [
      key,
      requiredElement(documentRef, id),
    ]),
  );
}
