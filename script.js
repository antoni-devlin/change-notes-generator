/**
 * Traverses the text to find the Markdown heading hierarchy for a specific line.
 */
function getHeadingState(text, targetLine) {
  const lines = text.split("\n");
  let stack = Array(7).fill("");

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#+)\s*(.+)/);

    if (match) {
      const level = match[1].length;
      stack[level] = trimmed;
      // When a new heading is found, reset all lower levels
      for (let i = level + 1; i <= 6; i++) stack[i] = "";
    }

    if (trimmed === targetLine.trim()) break;
  }

  const hierarchy = stack.filter((h) => h !== "").join("\n");
  return hierarchy ? `LOCATION:\n${hierarchy}` : `LOCATION:\nGeneral`;
}

/**
 * Main function to generate the diff notes.
 */
function generateChangeNotes() {
  const oldText = document.getElementById("oldContent").value;
  const newText = document.getElementById("newContent").value;
  const outputDiv = document.getElementById("output");

  const diff = Diff.diffLines(oldText, newText, { newlineIsToken: true });

  const notes = [];
  let changeCounter = 1;

  for (let i = 0; i < diff.length; i++) {
    const part = diff[i];
    const nextPart = diff[i + 1];
    const value = part.value.trim();

    // Skip headers (we only want body content changes) and empty lines
    if (!value || value.startsWith("#")) continue;

    const contextText = part.added ? newText : oldText;
    const locationString = getHeadingState(contextText, value);

    let actionText = "";

    // Determine if this is a CHANGE (Remove + Add), DELETE, or ADD
    if (part.removed && nextPart && nextPart.added) {
      actionText = `CHANGE\n\n${value}\n\nTO\n\n${nextPart.value.trim()}`;
      i++; // Skip next part as it's already handled
    } else if (part.removed) {
      actionText = `DELETE\n\n${value}`;
    } else if (part.added) {
      actionText = `ADD\n\n${value}`;
    }

    if (actionText) {
      notes.push(`[${changeCounter}]\n${locationString}\n\n${actionText}`);
      changeCounter++;
    }
  }

  outputDiv.textContent =
    notes.length > 0
      ? notes.join("\n\n---\n\n")
      : "No content changes detected.";
}

// Bind the button click to the logic
document
  .getElementById("generateBtn")
  .addEventListener("click", generateChangeNotes);

// Function to copy change notes to clipboard
function copyChangeNotes() {
  const outputText = document.getElementById("output").textContent;
  navigator.clipboard
    .writeText(outputText)
    .then(() => {
      const btn = document.getElementById("copyBtn");
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
}

// Bind the copy button
document.getElementById("copyBtn").addEventListener("click", copyChangeNotes);
