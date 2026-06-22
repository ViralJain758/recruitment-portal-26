export default function FormField({ as = "input", label, options, ...props }) {
  const Field = as;

  return (
    <div className="form-group">
      <label htmlFor={props.id}>{label}</label>
      {options ? (
        <select {...props}>
          {options.map(({ label: optionLabel, value }) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
      ) : (
        <Field {...props} />
      )}
    </div>
  );
}
