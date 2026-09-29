// IndexNow payloads. Extracted so the shape can be tested — getting it wrong cost a
// silent 422 from Naver that looked like a working integration.
export const ENDPOINTS = [
  { name: 'api.indexnow.org', url: 'https://api.indexnow.org/indexnow', note: 'shared with Bing · Yandex · Seznam' },
  { name: 'searchadvisor.naver.com', url: 'https://searchadvisor.naver.com/indexnow', note: 'Naver' },
];
export const BATCH = 10000;

// keyLocation is optional in the spec: it exists for key files that are NOT at the root,
// which is the only place we ever write one. Naver rejects the entire request with
// 422 "Invalid urls" when it is present — verified against the live endpoint — so it is
// omitted everywhere rather than special-cased per engine.
export function payload({ host, key, urls }) {
  return { host, key, urlList: urls };
}

export const chunk = (urls, size = BATCH) => {
  const out = [];
  for (let i = 0; i < urls.length; i += size) out.push(urls.slice(i, i + size));
  return out;
};
