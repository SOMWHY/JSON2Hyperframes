const Ajv = require("ajv");
const fs = require("fs");
const path = require("path");

const schema = JSON.parse(fs.readFileSync("schemas/video-config.schema.json", "utf8"));
const ajv = new Ajv({ allErrors: true, verbose: true });
const validate = ajv.compile(schema);

// Schema-level fixtures (caught by Ajv): must fail at schema level
const schemaLevelFixtures = new Set([
  "01-missing-scene-id.json",     // scene missing id
  "03-repeat-negative-one.json",  // repeat: -1 (minimum 0)
  "05-transform-in-style.json",   // transform in style (additionalProperties)
  "08-illegal-transition-type.json", // transition type not in enum
]);

// Cross-field invariants (require code-level validator in Step 2):
// Schema alone cannot catch these — they need a custom validator.
// Listed for documentation purposes; currently expected to pass Ajv.
const crossFieldFixtures = new Set([
  "02-track-overlap.json",        // same track overlapping time windows
  "04-animation-property-outside-allowlist.json", // anim prop not in GSAP allowlist
  "06-variable-value-undeclared-key.json", // values key not in declarations
  "07-illegal-ease-name.json",    // ease name not in GSAP catalog
  "09-circular-start-reference.json", // circular start reference
  "10-enum-value-outside-options.json", // enum value not in options
  "11-duration-exceeds-scenes.json", // root duration < scene sum
]);

// Validate demo.json
const demo = JSON.parse(fs.readFileSync("examples/demo.json", "utf8"));
const valid = validate(demo);
console.log("=== demo.json ===");
console.log("Valid:", valid);
if (!valid) {
  console.log("Errors:", JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

// Validate all invalid fixtures
const invalidDir = "examples/invalid";
const files = fs.readdirSync(invalidDir).sort();
let schemaPass = 0, schemaFail = 0, crossField = 0;

console.log("\n=== Invalid fixtures ===");
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(invalidDir, file), "utf8"));
  const valid = validate(data);

  if (schemaLevelFixtures.has(file)) {
    // Schema-level fixture: must fail Ajv
    if (!valid) {
      schemaPass++;
      const firstError = validate.errors[0].instancePath + " " + validate.errors[0].message;
      console.log(`✓ ${file}: FAILED as expected → ${firstError}`);
    } else {
      schemaFail++;
      console.log(`✗ ${file}: PASSED (unexpected) — schema-level fixture should have failed`);
    }
  } else if (crossFieldFixtures.has(file)) {
    // Cross-field invariant: requires code-level validator (Step 2)
    if (!valid) {
      console.log(`⚠ ${file}: FAILED schema (unexpected) — expected cross-field pass → ${validate.errors[0].instancePath} ${validate.errors[0].message}`);
    } else {
      console.log(`⚠ ${file}: PASSED schema (expected) — requires code-level validator (Step 2)`);
    }
    crossField++;
  } else {
    // Unknown fixture
    if (!valid) {
      console.log(`? ${file}: FAILED → ${validate.errors[0].instancePath} ${validate.errors[0].message}`);
      schemaPass++;
    } else {
      console.log(`? ${file}: PASSED (not categorized)`);
      schemaFail++;
    }
  }
}

console.log(`\nResults: ${schemaPass}/${schemaLevelFixtures.size} schema-level fixtures correctly failed`);
console.log(`${crossField}/${crossFieldFixtures.size} cross-field invariants (require Step 2 code validator)`);
if (schemaFail > 0) console.log(`${schemaFail} schema-level fixtures unexpectedly passed`);

// Summary
const total = files.length;
const expected = schemaLevelFixtures.size;
console.log(`\nTotal: ${total} fixtures (${expected} schema-level, ${crossField} cross-field)`);