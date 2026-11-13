export function ChartMessage({ title, message }: { title: string; message: string }) {
  return (
    <section className="max-w-prose">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">{message}</p>
    </section>
  );
}
