// Keep unfinished exchange forms through UI updates, without creating saved messages.
// This store is intentionally in memory; invitation drafts have their own persistence.
export function createFormDraftStore() {
  const drafts = new Map();
  const key = form => `${form.id}:${form.dataset.id}`;
  const supported = new Set(['text', 'textarea', 'radio', 'checkbox', 'select-one']);
  return {
    capture(root) {
      root?.querySelectorAll('#message-form, #review-form').forEach(form => {
        drafts.set(key(form), Array.from(form.elements)
          .filter(input => input.name && !input.disabled && supported.has(input.type))
          .map(input => ({ name: input.name, type: input.type, value: input.value, checked: input.checked })));
      });
    },
    restore(root) {
      root?.querySelectorAll('#message-form, #review-form').forEach(form => {
        const fields = drafts.get(key(form));
        if (!fields) return;
        for (const input of form.elements) {
          if (input.disabled) continue;
          const choice = ['radio', 'checkbox'].includes(input.type);
          const saved = fields.find(field => field.name === input.name && field.type === input.type &&
            (!choice || field.value === input.value));
          if (!saved) continue;
          if (choice) input.checked = saved.checked;
          else if (input.type !== 'select-one' || Array.from(input.options).some(option => option.value === saved.value))
            input.value = saved.value;
        }
      });
    },
    clear() { drafts.clear(); },
  };
}
