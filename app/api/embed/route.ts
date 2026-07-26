type EmbedResponse = {
  embeddings?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json()) as { inputs?: unknown };
  const inputs = Array.isArray(body.inputs)
    ? body.inputs.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 60)
    : [];
  if (inputs.length === 0) {
    return Response.json({ error: "empty_inputs" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${process.env.OLLAMA_HOST || "http://127.0.0.1:11434"}/api/embed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_EMBED_MODEL || "embeddinggemma",
          input: inputs,
          truncate: true,
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!response.ok) throw new Error(`ollama_${response.status}`);
    const data = (await response.json()) as EmbedResponse;
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length) {
      throw new Error("invalid_embeddings");
    }
    return Response.json({ embeddings: data.embeddings, engine: "ollama" });
  } catch {
    return Response.json(
      { error: "semantic_search_unavailable" },
      { status: 503 },
    );
  }
}
