---
trigger: always_on
---

# Analyze Before Write

**CRITICAL RULE**: Before doing ANY task (whether it is writing to a file, making structural changes, or doing deep analysis), you MUST first identify and analyze **ALL** files relevant to the task.

## Why this is mandatory:
1. **Preventing omissions**: You must not miss any file that is important to the task or related to the workflow.
2. **Contextual understanding**: You must get a complete and clear understanding of the task and its context within the wider project before making any changes.
3. **Intent and alignment**: You must understand *why* the task exists and *how* it can be worked upon safely using the combined context gained from reading all related files.

**Actionable Instruction**: Use your `view_file` and `grep_search` tools to aggressively map out and read all connected files before you begin modifying code or proposing an implementation plan.
