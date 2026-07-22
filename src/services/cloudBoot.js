export function shouldUseCloudBootCache(requestUrl, requestMethod = "GET") {
  const url = String(requestUrl || "");
  const method = String(requestMethod || "GET").toUpperCase();

  if (method !== "GET" || !url.includes("/rest/v1/erpmini_cloud_data")) {
    return false;
  }

  // O cache de abertura serve apenas para a leitura do snapshot do próprio
  // usuário. Consultas administrativas, que listam todas as lojas, precisam
  // chegar ao Supabase sem qualquer interceptação.
  return /(?:\?|&)user_id=eq\.[^&]+/.test(url);
}
