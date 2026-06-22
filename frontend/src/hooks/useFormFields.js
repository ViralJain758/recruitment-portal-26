import { useState } from "react";

export default function useFormFields(initialValues) {
  const [values, setValues] = useState(initialValues);

  return [
    values,
    ({ target }) =>
      setValues((current) => ({ ...current, [target.name]: target.value })),
    setValues,
  ];
}
