export const seoConfig = {
  appName: 'Klinik Utama Prime Mata',
  shortName: 'Klinik Utama Prime Mata',
  description:
    'Dashboard keuangan klinik untuk pendapatan, hutang-piutang, voucher, payroll, pajak, aset, rekonsiliasi, dan laporan manajemen.',
  image: '/og-image.svg',
};

const setMetaByAttribute = (attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
};

export function applyPageSeo(pageTitle: string) {
  const title = `${pageTitle} | ${seoConfig.shortName}`;
  const description = `${pageTitle} di ${seoConfig.description}`;

  document.title = title;
  setMetaByAttribute('name', 'description', description);
  setMetaByAttribute('property', 'og:title', title);
  setMetaByAttribute('property', 'og:description', description);
  setMetaByAttribute('property', 'og:image', seoConfig.image);
  setMetaByAttribute('name', 'twitter:title', title);
  setMetaByAttribute('name', 'twitter:description', description);
  setMetaByAttribute('name', 'twitter:image', seoConfig.image);
}
