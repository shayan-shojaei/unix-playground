import type { ConceptGuide } from '../curriculum/types';

export default function GuidePanel({ guide }: { guide: ConceptGuide }) {
  return (
    <aside className="guide">
      <p className="guide-concept">{guide.concept}</p>
      <p className="guide-desc">{guide.description}</p>

      <p className="guide-heading">syntax</p>
      <pre className="guide-syntax">{guide.syntax}</pre>

      {guide.flags.length > 0 && (
        <>
          <p className="guide-heading">flags</p>
          <dl className="guide-flags">
            {guide.flags.map((f) => (
              <div className="guide-flag-row" key={f.flag}>
                <dt>{f.flag}</dt>
                <dd>{f.desc}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <p className="guide-heading">examples</p>
      <div className="guide-examples">
        {guide.examples.map((ex, i) => (
          <div className="guide-example" key={i}>
            <p className="guide-example-cmd">$ {ex.cmd}</p>
            <pre className="guide-example-out">{ex.output}</pre>
            {ex.note && <p className="guide-example-note">{ex.note}</p>}
          </div>
        ))}
      </div>
    </aside>
  );
}
