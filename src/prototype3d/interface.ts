import { P0 as t } from '../data/text';
import { emptyNote } from './rules';
import type { Photo, Bookmark } from './rules';
import type { Journal } from './storage';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', label = '') {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = label;
  return el;
}
export function button(label: string, action: () => void, cls = '') {
  const b = element('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
}
function glyph(cls: string) {
  const g = element('i', 'icon ' + cls);
  g.ariaHidden = 'true';
  return g;
}
export function tool(label: string, icon: string, action: () => void) {
  const b = button('', action, 'tool');
  b.ariaLabel = label;
  b.append(glyph(icon), element('span', '', label));
  return b;
}
export function makeShell(root: HTMLElement) {
  const canvas = element('canvas');
  canvas.id = 'view';
  canvas.ariaLabel = t.title;
  canvas.tabIndex = 0;
  const top = element('header', 'hud-top');
  const identity = element('div', 'identity');
  const mark = element('span', 'sun');
  mark.ariaHidden = 'true';
  const loc = element('div'),
    name = element('small', 'brand', t.title),
    place = element('strong', 'location', t.home);
  loc.append(name, place);
  identity.append(mark, loc);
  const when = element('span', 'when');
  identity.append(when);
  const nav = element('nav', 'tools');
  top.append(identity, nav);
  const message = element('div', 'message');
  message.setAttribute('role', 'status');
  const lower = element('footer', 'hud-bottom');
  const note = element('div', 'field-note');
  note.append(element('small', 'field-label', t.fieldLabel));
  const hint = element('p', 'hint');
  note.append(hint);
  const actions = element('div', 'actions'),
    keys = element('div', 'keys', t.controls);
  const status = element('div', 'save-state');
  status.setAttribute('aria-live', 'polite');
  const saveText = element('span');
  const retry = element('button', 'retry', t.retry);
  status.append(saveText, retry);
  lower.append(note, actions, keys, status);
  const finder = element('div', 'finder');
  finder.ariaHidden = 'true';
  const focus = element('div', 'focus'),
    zoom = element('span', 'zoom');
  finder.append(element('i', 'reticle'), focus, zoom);
  const dialog = element('dialog', 'panel');
  const header = element('div', 'panel-head'),
    title = element('h1');
  title.id = 'panel-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const close = element('button', 'close', t.close);
  header.append(title, close);
  const saveInPanel = element('div', 'panel-save');
  saveInPanel.setAttribute('aria-live', 'polite');
  const content = element('div', 'panel-content');
  dialog.append(header, content, saveInPanel);
  root.append(canvas, top, finder, message, lower, dialog);
  return {
    canvas,
    nav,
    place,
    when,
    message,
    hint,
    actions,
    keys,
    status,
    saveText,
    retry,
    focus,
    zoom,
    dialog,
    title,
    close,
    content,
    saveInPanel,
  };
}
export type Shell = ReturnType<typeof makeShell>;

export function photoName(photo: Photo) {
  return photo.evidenceGranted.ecology
    ? t.photoName.ecology
    : photo.evidenceGranted.encounter
      ? t.photoName.encounter
      : t.photoName.scene;
}

export class Notebook {
  private urls = new Map<string, string>();
  selection: string | null = null;
  constructor(
    private journal: Journal,
    private broken: (id: string) => void,
  ) {}
  private image(photo: Photo, alt: string) {
    if (!this.urls.has(photo.id)) this.urls.set(photo.id, URL.createObjectURL(photo.imageBlob));
    const img = element('img');
    img.alt = alt;
    img.src = this.urls.get(photo.id)!;
    img.addEventListener(
      'error',
      () => {
        img.replaceWith(element('span', 'image-error', t.badImage));
        this.broken(photo.id);
      },
      { once: true },
    );
    return img;
  }

  render(container: HTMLElement, home: boolean) {
    const { photos, record } = this.journal;
    container.replaceChildren();
    const records = element('section', 'records');
    records.ariaLabel = t.records;
    for (const [label, seen] of [
      [t.met, record.encounterSeen],
      [t.learned, record.ecologySeen],
      [t.friend, record.trustEventSeen],
    ] as const) {
      const badge = element('span', seen ? 'done' : '', label);
      badge.ariaLabel = label + ' ' + (seen ? t.tick : t.blank);
      records.append(badge);
    }
    container.append(records);
    if (record.framePhotoId && !photos.some((p) => p.id === record.framePhotoId))
      container.append(element('p', 'warning', t.missing));
    if (!photos.length) {
      container.append(element('p', 'empty', t.bookEmpty));
      return;
    }
    const photo =
      photos.find((p) => p.id === this.selection) ??
      photos.find((p) => p.id === record.framePhotoId) ??
      photos.at(-1)!;
    this.selection = photo.id;
    const layout = element('section', 'book-layout'),
      left = element('div', 'photo-page'),
      right = element('div', 'writing-page');
    const print = element('figure', 'print'),
      caption = element('figcaption');
    const name = photoName(photo),
      day = t.day(photo.capturedDay) + ' · ' + t.periods[photo.capturedDayPart];
    caption.append(element('strong', '', name), element('span', '', day));
    print.append(this.image(photo, t.photoAlt), caption);
    left.append(print);
    const strip = element('div', 'strip');
    strip.ariaLabel = t.photos;
    photos.forEach((p, i) => {
      const thumb = button(
        '',
        () => {
          this.selection = p.id;
          this.render(container, home);
        },
        'thumb',
      );
      thumb.ariaLabel = t.photo(i + 1) + ' ' + photoName(p);
      thumb.setAttribute('aria-pressed', String(p.id === photo.id));
      thumb.append(this.image(p, t.photo(i + 1)));
      strip.append(thumb);
    });
    left.append(strip);
    const selected = record.framePhotoId === photo.id;
    const exhibit = button(
      selected ? t.onWall : t.exhibit,
      () => {
        this.journal.change({ kind: 'frame', id: photo.id });
        this.render(container, home);
      },
      'primary',
    );
    exhibit.disabled = selected || !home;
    right.append(element('h2', '', t.frame), exhibit);
    if (!home) right.append(element('small', '', t.homeOnly));
    const note = record.notes[photo.id] ?? emptyNote();
    const label = element('label', '', t.memo);
    label.htmlFor = 'memo';
    const input = element('textarea');
    input.id = 'memo';
    input.rows = 4;
    input.placeholder = t.memoHint;
    input.value = note.memoText;
    input.addEventListener('input', () =>
      this.journal.change({ kind: 'memo', id: photo.id, text: input.value }),
    );
    right.append(label, input);
    const bookmark = element('label', '', t.bookMark);
    bookmark.htmlFor = 'bookmark';
    const select = element('select');
    select.id = 'bookmark';
    const choices: [Bookmark, string][] = [['', t.choices.none]];
    if (record.encounterSeen) choices.push(['quiet', t.choices.quiet]);
    if (record.ecologySeen) choices.push(['nuts', t.choices.nuts]);
    for (const [key, labelText] of choices) {
      const opt = element('option', '', labelText);
      opt.value = key;
      select.append(opt);
    }
    select.value = note.hypothesisId;
    select.onchange = () =>
      this.journal.change({ kind: 'bookmark', id: photo.id, value: select.value as Bookmark });
    right.append(bookmark, select);
    layout.append(left, right);
    container.append(layout);
  }
}
