export default function AboutTab({ space }) {
  return (
    <>
      <h3>About this space</h3>
      <p>
        {space.description ||
          "This is where space details, rules, and admin-managed content will appear."}
      </p>
    </>
  );
}
