const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function createApp() {
  const elements = new Map();
  const timeouts = [];
  let copiedText;

  function getElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        textContent: "",
        value: "",
        listeners: {},
        addEventListener(event, listener) {
          this.listeners[event] = listener;
        },
        click() {
          this.listeners.click();
        },
      });
    }

    return elements.get(id);
  }

  for (const id of [
    "oldContent",
    "newContent",
    "output",
    "generateBtn",
    "copyBtn",
  ]) {
    getElement(id);
  }

  const context = {
    document: { getElementById: getElement },
    navigator: {
      clipboard: {
        writeText(text) {
          copiedText = text;
          return Promise.resolve();
        },
      },
    },
    setTimeout(callback, delay) {
      timeouts.push({ callback, delay });
    },
  };

  for (const file of ["diff.min.js", "script.js"]) {
    vm.runInNewContext(
      fs.readFileSync(path.join(root, file), "utf8"),
      context,
      {
        filename: file,
      },
    );
  }

  return {
    elements,
    get copiedText() {
      return copiedText;
    },
    timeouts,
  };
}

function generateNotes(oldContent, newContent) {
  const app = createApp();
  app.elements.get("oldContent").value = oldContent;
  app.elements.get("newContent").value = newContent;
  app.elements.get("generateBtn").click();
  return app.elements.get("output").textContent;
}

test("normalizes punctuation and whitespace", () => {
  assert.equal(
    generateNotes("  It’s   ready—now.  ", "It's ready-now."),
    "No content changes detected.",
  );
});

test("reports added and deleted content with its heading", () => {
  const added = generateNotes("# Guide", "# Guide\nNew paragraph");
  assert.match(added, /LOCATION:\n# Guide/);
  assert.match(added, /ADD\n\nNew paragraph/);

  const deleted = generateNotes("# Guide\nOld paragraph", "# Guide");
  assert.match(deleted, /LOCATION:\n# Guide/);
  assert.match(deleted, /DELETE\n\nOld paragraph/);
});

test("reports replaced content as a change", () => {
  const notes = generateNotes(
    "# Guide\nOld paragraph",
    "# Guide\nNew paragraph",
  );

  assert.match(notes, /CHANGE\n\nOld paragraph\n\nTO\n\nNew paragraph/);
  assert.match(notes, /LOCATION:\n# Guide/);
});

test("attributes a multi-line change to the heading where it starts", () => {
  const oldContent =
    "# First section\nOld first line\nOld second line\n\n# Later section\nKeep this";
  const newContent =
    "# First section\nNew first line\nNew second line\n\n# Later section\nKeep this";
  const notes = generateNotes(oldContent, newContent);

  assert.match(notes, /LOCATION:\n# First section/);
  assert.doesNotMatch(notes, /LOCATION:\n# Later section/);
});

test("copies the generated output and restores the button label", async () => {
  const app = createApp();
  const output = app.elements.get("output");
  const copyButton = app.elements.get("copyBtn");
  output.textContent = "Generated notes";
  copyButton.textContent = "Copy change notes";

  copyButton.click();
  await Promise.resolve();

  assert.equal(app.copiedText, "Generated notes");
  assert.equal(copyButton.textContent, "Copied!");
  assert.equal(app.timeouts[0].delay, 2000);

  app.timeouts[0].callback();
  assert.equal(copyButton.textContent, "Copy change notes");
});
