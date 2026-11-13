/**
 * Proxy server-side entre a interface (Vercel) e o backend (Heroku).
 * O navegador acessa somente /api/* na propria origem do frontend;
 * cookies de sessao HTTP-only sao mantidos nesse dominio.
 * API_INTERNAL_URL deve ser a URL BASE do backend, SEM /api.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };

function responseError(status: number, error: string) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function backendBase(): URL | null {
  const value = process.env.API_INTERNAL_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || isLocal)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    // Tolerancia a quem configurou /api no final por engano.
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '' && path !== '/api') return null;
    url.pathname = '/';
    return url;
  } catch { return null; }
}

async function proxy(request: Request, context: Context): Promise<Response> {
  const base = backendBase();
  if (!base) {
    return responseError(503, 'Conexao com a API nao configurada. Na Vercel, configure API_INTERNAL_URL com https://SEU-BACKEND.herokuapp.com (sem /api), marque Production e publique novamente.');
  }

  const { path } = await context.params;
  const destination = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, base);
  destination.search = new URL(request.url).search;
  const headers = new Headers();
  // Apenas os cabecalhos necessarios: nao enviar host/cookies de infra Vercel.
  for (const name of ['content-type', 'accept', 'cookie', 'origin', 'x-request-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(destination.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const contentType = upstream.headers.get('content-type') || '';

    // Em uma URL Heroku errada ou com root incorreta, o backend responde HTML 404.
    if (upstream.status === 404 && !contentType.includes('application/json')) {
      return responseError(502, 'O backend respondeu 404 para esta rota. Confira se o Heroku executa o projeto vezora-backend e se API_INTERNAL_URL aponta para o app correto.');
    }
    // Nunca entregar paginas HTML de erro Heroku como se fossem respostas da API.
    if (upstream.status >= 500 && !contentType.includes('application/json')) {
      return responseError(502, 'O servidor Heroku esta indisponivel. Confira o status do dyno e os logs do backend.');
    }

    const outHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'location', 'set-cookie']) {
      const value = upstream.headers.get(name);
      if (value) outHeaders.set(name, value);
    }
    return new Response(request.method === 'HEAD' ? null : await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (error) {
    console.error('[Vezora API proxy] backend indisponivel:', error);
    return responseError(502, 'Nao foi possivel conectar ao backend no Heroku. Verifique API_INTERNAL_URL, MongoDB e os logs do dyno.');
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
