import { TaskRow } from "./TaskRow";

export function GameGroup({ name, tasks, completed, toggle }) {
  if (!tasks.length) {
    return null;
  }
  return (
    <article class="game-group">
      <div class="game-title">
        <div>
          <h2>{name}</h2>
        </div>
        <span>
          {tasks.filter((task) => completed.has(task.id)).length}/{tasks.length}
        </span>
      </div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          completed={completed.has(task.id)}
          toggle={toggle}
        />
      ))}
    </article>
  );
}
