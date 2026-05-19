export const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzDTHF0pBcgSMU0CAXCW1BJBZfMenPu_FCdTSL_DFHSfIrqEWWvDU1-jjtD14VpN8jPTA/exec';

export const fetchGAS = (action, payload = {}) => {
  const params = new URLSearchParams();
  params.append('action', action);
  params.append('data', JSON.stringify(payload));
  params.append('t', Date.now());
  const url = `${GAS_URL}?${params.toString()}`;

  return fetch(url, { method: 'GET', redirect: 'follow' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .catch(() => jsonpFetch(url));
};

function jsonpFetch(baseUrl) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gas_cb_' + Math.round(1e8 * Math.random());
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('서버 응답 시간이 초과되었습니다.'));
    }, 20000);

    const cleanup = () => {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => { cleanup(); resolve(data); };

    const script = document.createElement('script');
    script.src = `${baseUrl}&callback=${callbackName}`;
    script.onerror = () => { cleanup(); reject(new Error('서버와 통신할 수 없습니다.')); };
    document.head.appendChild(script);
  });
}
