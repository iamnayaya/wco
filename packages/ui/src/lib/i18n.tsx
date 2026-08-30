import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * WCO i18n — dependency-free internationalization for the advanced library.
 *
 * A single provider (`I18nProvider`) carries two runtime facts every
 * component reads:
 * - `t`  — the string table for the active locale (with sensible English
 *   defaults embedded in each component, so consumers are never forced to
 *   wire strings up before a component works).
 * - `dir` — the resolved text direction (`ltr`/`rtl`), derived from the
 *   locale when `dir="auto"`, exposed to consumers as `dir={ctx.dir}` so
 *   layout mirrors automatically.
 *
 * Components accept an optional `strings?: Partial<CoreStrings>` prop that is
 * merged over the global table — the "prop fallback → context → English
 * default" chain means a component is never unstyled or untranslated.
 */

/** Canonical strings used across the advanced component library. */
export interface CoreStrings {
  close: string;
  open: string;
  cancel: string;
  confirm: string;
  done: string;
  loading: string;
  search: string;
  noResults: string;
  clear: string;
  remove: string;
  moreOptions: string;
  select: string;
  upload: string;
  chooseFile: string;
  dropFile: string;
  today: string;
  previous: string;
  next: string;
  weekdaysShort: readonly string[];
  monthsShort: readonly string[];
  commands: string;
  quickActions: string;
  notFound: string;
  allMessagesRead: string;
  online: string;
  offline: string;
  busy: string;
  away: string;
  success: string;
  failure: string;
  partial: string;
  newChat: string;
  attachment: string;
  reactions: string;
}

const en = {
  close: 'Close',
  open: 'Open',
  cancel: 'Cancel',
  confirm: 'Confirm',
  done: 'Done',
  loading: 'Loading…',
  search: 'Search',
  noResults: 'No results',
  clear: 'Clear',
  remove: 'Remove',
  moreOptions: 'More options',
  select: 'Select',
  upload: 'Upload',
  chooseFile: 'Choose file',
  dropFile: 'Drop file here',
  today: 'Today',
  previous: 'Previous',
  next: 'Next',
  weekdaysShort: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  monthsShort: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ],
  commands: 'Commands',
  quickActions: 'Quick actions',
  notFound: 'Nothing found',
  allMessagesRead: 'All caught up',
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  away: 'Away',
  success: 'Success',
  failure: 'Lost connection',
  partial: 'In progress',
  newChat: 'New chat',
  attachment: 'Attachment',
  reactions: 'Reactions',
} satisfies CoreStrings;

const fr: CoreStrings = {
  ...en,
  close: 'Fermer',
  open: 'Ouvrir',
  cancel: 'Annuler',
  confirm: 'Confirmer',
  done: 'Terminé',
  loading: 'Chargement…',
  search: 'Rechercher',
  noResults: 'Aucun résultat',
  clear: 'Effacer',
  remove: 'Retirer',
  moreOptions: "Plus d'options",
  select: 'Sélectionner',
  upload: 'Envoyer',
  chooseFile: 'Choisir un fichier',
  dropFile: 'Déposer le fichier',
  today: "Aujourd'hui",
  previous: 'Précédent',
  next: 'Suivant',
  weekdaysShort: ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'],
  monthsShort: [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
  ],
};

const ar: CoreStrings = {
  ...en,
  close: 'إغلاق',
  open: 'فتح',
  cancel: 'إلغاء',
  confirm: 'تأكيد',
  done: 'تم',
  loading: 'جارٍ التحميل…',
  search: 'بحث',
  noResults: 'لا نتائج',
  clear: 'مسح',
  remove: 'إزالة',
  moreOptions: 'خيارات إضافية',
  select: 'تحديد',
  upload: 'رفع',
  chooseFile: 'اختيار ملف',
  dropFile: 'أفلت الملف هنا',
  today: 'اليوم',
  previous: 'السابق',
  next: 'التالي',
  weekdaysShort: ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
  monthsShort: [
    'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون',
    'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس',
  ],
};

const sw: CoreStrings = {
  ...en,
  close: 'Funga',
  open: 'Fungua',
  cancel: 'Ghairi',
  confirm: 'Thibitisha',
  done: 'Imekamilika',
  loading: 'Inapakia…',
  search: 'Tafuta',
  noResults: 'Hakuna matokeo',
  clear: 'Futa',
  remove: 'Ondoa',
  moreOptions: 'Chaguo zaidi',
  select: 'Chagua',
  upload: 'Pakia',
  chooseFile: 'Chagua faili',
  dropFile: 'Acha faili hapa',
  today: 'Leo',
  previous: 'Iliyopita',
  next: 'Inayofuata',
  weekdaysShort: ['J2', 'J3', 'J4', 'J5', 'Al', 'Ij', 'J1'],
  monthsShort: [
    'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des',
  ],
};

const yo: CoreStrings = {
  ...en,
  close: 'Pade',
  open: 'Ṣii',
  cancel: 'Fagii',
  confirm: 'Jẹ́mí',
  done: 'Tan',
  loading: 'Ǹjẹ́ ikojọpọ…',
  search: 'Ṣàwárí',
  noResults: 'Kò sí àbájáde',
  clear: 'Páà',
  remove: 'Yọ kúrò',
  moreOptions: 'Àwọn àyànfẹ́ mìíràn',
  select: 'Yàn',
  upload: 'Gbé sí sókè',
  chooseFile: 'Yan fáìlì',
  dropFile: 'Jáwọ́ fáìlì síbẹ̀',
  today: 'Lónìí',
  previous: 'Tẹ́lẹ̀',
  next: 'Tó nbọ̀',
};

const hi: CoreStrings = {
  ...en,
  close: 'बंद करें',
  open: 'खोलें',
  cancel: 'रद्द करें',
  confirm: 'पुष्टि करें',
  done: 'पूर्ण',
  loading: 'लोड हो रहा है…',
  search: 'खोजें',
  noResults: 'कोई परिणाम नहीं',
  clear: 'साफ़ करें',
  remove: 'हटाएँ',
  moreOptions: 'अधिक विकल्प',
  select: 'चुनें',
  upload: 'अपलोड',
  chooseFile: 'फ़ाइल चुनें',
  dropFile: 'फ़ाइल यहाँ छोड़ें',
  today: 'आज',
};

const pt: CoreStrings = {
  ...en,
  close: 'Fechar',
  open: 'Abrir',
  cancel: 'Cancelar',
  confirm: 'Confirmar',
  done: 'Concluído',
  loading: 'Carregando…',
  search: 'Pesquisar',
  noResults: 'Sem resultados',
  clear: 'Limpar',
  remove: 'Remover',
  moreOptions: 'Mais opções',
  select: 'Selecionar',
  upload: 'Enviar',
  chooseFile: 'Escolher arquivo',
  dropFile: 'Solte o arquivo aqui',
  today: 'Hoje',
  weekdaysShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  monthsShort: [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ],
};

/** Locale table — add a culture in a few keys and every advanced component follows. */
export const locales: Record<string, CoreStrings> = {
  en,
  'fr-FR': fr,
  'ar-SA': ar,
  'ar-EG': ar,
  sw: sw,
  yo: yo,
  hi: hi,
  'pt-BR': pt,
};

/** RFC-4646 locale codes whose scripts are right-to-left. */
const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur', 'ps']);

export type TextDirection = 'ltr' | 'rtl';

function dirForLocale(locale: string): TextDirection {
  const root = locale.split('-')[0]?.toLowerCase();
  return root && RTL_LOCALES.has(root) ? 'rtl' : 'ltr';
}

export interface WcoI18n {
  locale: string;
  dir: TextDirection;
  t: CoreStrings;
}

const I18nContext = createContext<WcoI18n>({
  locale: 'en',
  dir: 'ltr',
  t: en,
});

export interface I18nProviderProps {
  locale?: string;
  /** Explicit text direction; `auto` derives it from `locale`. */
  dir?: TextDirection | 'auto';
  children: ReactNode;
}

/** Wraps an app (or a Storybook decorator) with the active locale + direction. */
export function I18nProvider({ locale = 'en', dir = 'auto', children }: I18nProviderProps) {
  const strings = locales[locale] ?? en;
  const direction = dir === 'auto' ? dirForLocale(locale) : dir;
  const value = useMemo<WcoI18n>(
    () => ({ locale, dir: direction, t: strings }),
    [locale, direction, strings],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Read the active locale, direction and string table. */
export function useWcoI18n(): WcoI18n {
  return useContext(I18nContext);
}

/** Merge a component's optional `strings` prop over the global table. */
export function mergeStrings(
  base: CoreStrings,
  overrides: Partial<CoreStrings> | undefined,
): CoreStrings {
  if (!overrides) return base;
  return { ...base, ...overrides };
}