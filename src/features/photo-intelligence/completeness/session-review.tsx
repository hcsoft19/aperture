import type { SessionCompleteness } from "@/features/photo-intelligence/completeness/review";

export function SessionReview({ review }: { review: SessionCompleteness }) {
  return (
    <section aria-labelledby="session-check" className="flex flex-col gap-3">
      <h2 id="session-check" className="text-xl font-medium">
        Session check
      </h2>
      <ul className="flex flex-col gap-2 text-base leading-7">
        {review.complete ? (
          <li>Every protocol angle has one photograph.</li>
        ) : (
          <>
            {review.missing.map((angle) => (
              <li key={angle.id}>Missing: {angle.name}</li>
            ))}
            {review.duplicates.map((angle) => (
              <li key={angle.id}>
                More than one photograph for {angle.name}. A person must confirm any change.
              </li>
            ))}
          </>
        )}
      </ul>
    </section>
  );
}
