/** @type {import('next').NextConfig} */
// As chamadas /api/* sao encaminhadas por app/api/[...path]/route.ts.
// Nao usar rewrites externas: se API_INTERNAL_URL estiver ausente,
// o cliente recebe um erro JSON diagnostico em vez de um 404 generico.
const nextConfig = {};
export default nextConfig;
