export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <article
        className="
          [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mb-2
          [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-2
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-1
          [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-muted-foreground
          [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground [&_ul]:space-y-1
          [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-muted-foreground [&_ol]:space-y-1
          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
          [&_strong]:text-foreground [&_strong]:font-semibold
          [&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-sm [&_blockquote]:text-muted-foreground
        "
      >
        {children}
      </article>
    </div>
  );
}
