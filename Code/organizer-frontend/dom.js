export const get = id => document.getElementById(id);

export function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

export function notify(message, id = 'notice') {
  const notice = get(id);
  notice.textContent = message;
  notice.hidden = !message;
}

export function withForm(form, handler, report = notify) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit], button:not([type])');
    button.disabled = true;
    report('');
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (error) {
      report(error.message);
    } finally {
      button.disabled = false;
    }
  });
}
