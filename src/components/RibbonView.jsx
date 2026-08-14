export function RibbonView({ groups, completed, toggle }) {
  return (
    <section class="reference-view">
      <header class="section-heading">
        <p class="eyebrow">Reference library</p>
        <h2>Ribbon atlas</h2>
        <p>
          Acquisition routes, transfer behavior, and the preservation targets
          connected to them.
        </p>
      </header>
      {groups.map((group) => (
        <article class="ribbon-group" key={group.id}>
          <div>
            <span class="tag">
              Gen {group.origin_generation} · {group.category}
            </span>
            <h3>{group.title || group.id.replaceAll("_", " ")}</h3>
            <p>{group.acquisition}</p>
            <small>{group.transfer_behavior.replaceAll("_", " ")}</small>
          </div>
          <ul>
            {group.ribbons.map((ribbon) => (
              <li key={ribbon.id}>
                <label class="ribbon-check">
                  <input
                    type="checkbox"
                    checked={completed.has(`ribbon:${group.id}:${ribbon.id}`)}
                    onChange={() => toggle(`ribbon:${group.id}:${ribbon.id}`)}
                  />
                  <span>
                    <strong>{ribbon.name}</strong>
                    {ribbon.home_title && (
                      <span>HOME title: {ribbon.home_title}</span>
                    )}
                    {ribbon.requirement && <span>{ribbon.requirement}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
