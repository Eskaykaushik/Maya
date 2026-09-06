export const COMPONENT_TYPES = [
  "text",
  "button",
  "input",
  "select",
  "slider",
  "toggle",
  "file",
  "metric",
  "diff",
];

export const LAYOUTS = ["stack"];

export const MAX_COMPONENTS = 4;

const SOURCE_TYPES = ["file", "input"];

const REF_PROPS = {
  diff: ["sourceA", "sourceB"],
};

export function validate(spec) {
  const errors = [];

  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return { ok: false, errors: ["spec must be an object"] };
  }

  if (!Array.isArray(spec.components)) {
    return { ok: false, errors: ["components must be an array"] };
  }

  const layout = spec.layout ?? "stack";
  if (!LAYOUTS.includes(layout)) {
    errors.push(`layout "${layout}" is not allowed (stack only)`);
  }

  if (spec.components.length === 0) {
    errors.push("components must not be empty");
  }

  if (spec.components.length > MAX_COMPONENTS) {
    errors.push(`too many components (${spec.components.length} > ${MAX_COMPONENTS})`);
  }

  const ids = new Set();
  const seen = new Set();

  spec.components.forEach((c, i) => {
    if (!c || typeof c !== "object") {
      errors.push(`component[${i}] must be an object`);
      return;
    }

    if (typeof c.type !== "string" || !COMPONENT_TYPES.includes(c.type)) {
      errors.push(`component[${i}]: type "${c.type}" is not allowed`);
    }

    if (typeof c.id !== "string" || c.id.length === 0) {
      errors.push(`component[${i}]: id is required`);
    } else {
      if (seen.has(c.id)) {
        errors.push(`duplicate id "${c.id}"`);
      } else {
        seen.add(c.id);
        ids.add(c.id);
      }
    }
  });

  spec.components.forEach((c, i) => {
    const refProps = c && typeof c.type === "string" ? (REF_PROPS[c.type] ?? []) : [];

    for (const prop of refProps) {
      const ref = c[prop];
      if (ref == null) continue;
      if (typeof ref !== "string") {
        errors.push(`component[${i}] ${prop} must be a string id`);
      } else if (!ids.has(ref)) {
        errors.push(`component[${i}] ${prop} "${ref}" does not reference a component id`);
      } else {
        const target = spec.components.find((x) => x.id === ref);
        if (target && !SOURCE_TYPES.includes(target.type)) {
          errors.push(`component[${i}] ${prop} "${ref}" must reference a file or input`);
        }
      }
    }
  });

  return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
}

export const specUtils = { validate };