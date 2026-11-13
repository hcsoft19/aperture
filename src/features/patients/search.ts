/** Keeps a chart search inside PostgREST filter syntax. */
export function patientSearchTerm(raw: string) {
  return raw
    .replace(/[,%_().\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function patientSearchFilter(raw: string) {
  const term = patientSearchTerm(raw);

  if (!term) {
    return null;
  }

  const [first, ...rest] = term.split(" ");

  if (!first) {
    return null;
  }

  if (rest.length === 0) {
    return `first_name.ilike."%${term}%",last_name.ilike."%${term}%"`;
  }

  const last = rest.join(" ");
  return [
    `and(first_name.ilike."%${first}%",last_name.ilike."%${last}%")`,
    `and(first_name.ilike."%${last}%",last_name.ilike."%${first}%")`,
  ].join(",");
}
