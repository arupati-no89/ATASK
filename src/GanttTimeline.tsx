import React from "react";
import { Calendar } from "lucide-react";

interface Project {
  id: string;
  machineNumber: string;
  projectName: string;
  customer?: string;
  deliveryDate?: string;
  status: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  deadline?: string;
  completed: boolean;
}

interface GanttTimelineProps {
  projects: Project[];
  tasks: Task[];
  timelineSortMode: string;
  setTimelineSortMode: (mode: string) => void;
  calculateProgress: (projectId: string) => number;
  getDeadlineStatus: (deadline: string | undefined, completed: boolean) => string;
}

export default function GanttTimeline({
  projects,
  tasks,
  timelineSortMode,
  setTimelineSortMode,
  calculateProgress,
  getDeadlineStatus,
}: GanttTimelineProps) {
  const activeProjects = projects.filter((p) => p.status !== "Completed");

  // ---- Sort helpers ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const countOverdue = (projectId: string) =>
    tasks.filter((t) => {
      if (t.projectId !== projectId || t.completed || !t.deadline) return false;
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      return d.getTime() < today.getTime();
    }).length;

  const countUrgent = (projectId: string) =>
    tasks.filter((t) => {
      if (t.projectId !== projectId || t.completed || !t.deadline) return false;
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 3;
    }).length;

  const countUncompleted = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && !t.completed).length;

  // Sort projects
  const sortedProjects = [...activeProjects].sort((a, b) => {
    const pa = calculateProgress(a.id);
    const pb = calculateProgress(b.id);
    const ta = tasks.filter((t) => t.projectId === a.id);
    const tb = tasks.filter((t) => t.projectId === b.id);
    const na = ta.filter((t) => !t.completed && t.deadline)
      .sort((x, y) => new Date(x.deadline!).getTime() - new Date(y.deadline!).getTime())[0]?.deadline;
    const nb = tb.filter((t) => !t.completed && t.deadline)
      .sort((x, y) => new Date(x.deadline!).getTime() - new Date(y.deadline!).getTime())[0]?.deadline;

    switch (timelineSortMode) {
      // ---- 日付系 ----
      case "deliveryDate":
        return (a.deliveryDate ? new Date(a.deliveryDate).getTime() : 9e15)
          - (b.deliveryDate ? new Date(b.deliveryDate).getTime() : 9e15);
      case "deliveryDateDesc":
        return (b.deliveryDate ? new Date(b.deliveryDate).getTime() : -9e15)
          - (a.deliveryDate ? new Date(a.deliveryDate).getTime() : -9e15);
      case "nearestDeadline":
        return (na ? new Date(na).getTime() : 9e15) - (nb ? new Date(nb).getTime() : 9e15);
      case "createdAtDesc":
        return ((b as any).createdAt ?? 0) - ((a as any).createdAt ?? 0);
      case "createdAtAsc":
        return ((a as any).createdAt ?? 0) - ((b as any).createdAt ?? 0);
      // ---- タスク状況系 ----
      case "overdueFirst":
        return countOverdue(b.id) - countOverdue(a.id);
      case "urgentFirst":
        return countUrgent(b.id) - countUrgent(a.id);
      case "uncompletedFirst":
        return countUncompleted(b.id) - countUncompleted(a.id);
      case "progress":
        return pa - pb;
      case "progressDesc":
        return pb - pa;
      // ---- 名前系 ----
      case "machineNumber":
        return (a.machineNumber || "").localeCompare(b.machineNumber || "", "ja");
      case "projectName":
        return (a.projectName || "").localeCompare(b.projectName || "", "ja");
      case "customer":
        return (a.customer || "").localeCompare(b.customer || "", "ja");
      default:
        return 0;
    }
  });

  // ---- Gantt chart date range ----

  const allDates = [
    ...tasks.filter((t) => t.deadline).map((t) => new Date(t.deadline!)),
    ...activeProjects.filter((p) => p.deliveryDate).map((p) => new Date(p.deliveryDate!)),
  ];
  let chartStart = new Date(today);
  chartStart.setDate(chartStart.getDate() - 21);
  let chartEnd = new Date(today);
  chartEnd.setDate(chartEnd.getDate() + 60);

  if (allDates.length > 0) {
    const minD = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxD = new Date(Math.max(...allDates.map((d) => d.getTime())));
    if (minD.getTime() < chartStart.getTime()) {
      chartStart = new Date(minD);
      chartStart.setDate(chartStart.getDate() - 7);
    }
    if (maxD.getTime() > chartEnd.getTime()) {
      chartEnd = new Date(maxD);
      chartEnd.setDate(chartEnd.getDate() + 14);
    }
  }

  const totalMs = chartEnd.getTime() - chartStart.getTime();
  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
  const PX_PER_DAY = 16;
  const CHART_WIDTH = totalDays * PX_PER_DAY;
  const LEFT_COL = 180;

  const dateToX = (d: Date | string): number => {
    const date = typeof d === "string" ? new Date(d) : new Date(d);
    date.setHours(0, 0, 0, 0);
    return Math.max(0, ((date.getTime() - chartStart.getTime()) / totalMs) * CHART_WIDTH);
  };

  const todayX = dateToX(today);

  // Month labels
  const monthLabels: { label: string; x: number }[] = [];
  const mDate = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
  while (mDate <= chartEnd) {
    const x = dateToX(mDate);
    if (x >= 0) {
      monthLabels.push({
        label: `${mDate.getFullYear()}年${mDate.getMonth() + 1}月`,
        x,
      });
    }
    mDate.setMonth(mDate.getMonth() + 1);
  }

  // Week labels (every 7 days starting from nearest Monday)
  const weekLabels: { label: string; x: number }[] = [];
  const wDate = new Date(chartStart);
  wDate.setDate(wDate.getDate() + ((8 - wDate.getDay()) % 7));
  while (wDate <= chartEnd) {
    weekLabels.push({
      label: `${wDate.getMonth() + 1}/${wDate.getDate()}`,
      x: dateToX(wDate),
    });
    wDate.setDate(wDate.getDate() + 7);
  }

  const getBarColors = (deadline: string | undefined, completed: boolean) => {
    if (completed) return { bar: "bg-gray-300", marker: "bg-gray-400", label: "text-gray-400" };
    const s = getDeadlineStatus(deadline, completed);
    if (s === "overdue") return { bar: "bg-red-300", marker: "bg-red-500", label: "text-red-600" };
    if (s === "urgent") return { bar: "bg-amber-300", marker: "bg-amber-500", label: "text-amber-700" };
    return { bar: "bg-emerald-300", marker: "bg-emerald-500", label: "text-emerald-700" };
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            タイムライン (工程表)
          </h2>
          <p className="text-sm text-gray-500">全プロジェクトの Gantt チャート</p>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm flex-shrink-0">
          <span className="text-gray-500 font-medium whitespace-nowrap">並び順:</span>
          <select
            value={timelineSortMode}
            onChange={(e) => setTimelineSortMode(e.target.value)}
            className="border-0 bg-transparent focus:outline-none font-semibold text-emerald-700 cursor-pointer"
          >
            <optgroup label="── 日付・期日 ──">
              <option value="deliveryDate">📅 納入日が早い順</option>
              <option value="deliveryDateDesc">📅 納入日が遅い順</option>
              <option value="nearestDeadline">⏰ タスク期限が近い順</option>
              <option value="createdAtDesc">🆕 登録が新しい順</option>
              <option value="createdAtAsc">🗂 登録が古い順</option>
            </optgroup>
            <optgroup label="── タスク状況 ──">
              <option value="overdueFirst">🔴 期限切れタスクが多い順</option>
              <option value="urgentFirst">⚠️ 緊急タスクが多い順</option>
              <option value="uncompletedFirst">📋 未完了タスクが多い順</option>
              <option value="progress">📉 進捗が低い順</option>
              <option value="progressDesc">📈 進捗が高い順</option>
            </optgroup>
            <optgroup label="── 名前順 ──">
              <option value="machineNumber">🔢 機番順</option>
              <option value="projectName">🏗 工事名順</option>
              <option value="customer">🏢 顧客名順</option>
            </optgroup>
          </select>
        </div>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] md:text-xs flex-shrink-0 bg-white px-3 py-2 rounded-lg border border-gray-100 shadow-sm">
        {[
          { c: "bg-emerald-500", l: "通常" },
          { c: "bg-amber-500", l: "3日以内" },
          { c: "bg-red-500", l: "期限切れ" },
          { c: "bg-gray-400", l: "完了" },
        ].map(({ c, l }) => (
          <div key={l} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${c}`} />
            <span className="text-gray-600">{l}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-4 bg-red-400" />
          <span className="text-gray-600">TODAY</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rotate-45 bg-teal-600" />
          <span className="text-gray-600">納入日</span>
        </div>
      </div>

      {/* Gantt chart body */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col min-h-0">
        {activeProjects.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            進行中のプロジェクトはありません。
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <div style={{ minWidth: LEFT_COL + CHART_WIDTH }}>

              {/* Sticky date-axis header row */}
              <div className="flex sticky top-0 z-30 bg-gray-50 border-b-2 border-gray-300 shadow-sm">
                {/* Corner cell */}
                <div
                  style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                  className="flex-shrink-0 sticky left-0 z-40 bg-gray-50 border-r-2 border-gray-300 h-14 flex items-end px-3 pb-2"
                >
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    工事 / タスク
                  </span>
                </div>
                {/* Date axis */}
                <div
                  style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH }}
                  className="flex-shrink-0 h-14 relative"
                >
                  {/* Month labels */}
                  {monthLabels.map((ml, i) => (
                    <div
                      key={i}
                      className="absolute top-0 text-xs font-bold text-gray-700 whitespace-nowrap px-2 pt-1.5 border-l-2 border-gray-300"
                      style={{ left: ml.x }}
                    >
                      {ml.label}
                    </div>
                  ))}
                  {/* Week labels */}
                  {weekLabels.map((wl, i) => (
                    <div
                      key={i}
                      className="absolute bottom-1 text-[10px] text-gray-400 whitespace-nowrap"
                      style={{ left: wl.x, transform: "translateX(-50%)" }}
                    >
                      {wl.label}
                    </div>
                  ))}
                  {/* Week grid lines */}
                  {weekLabels.map((wl, i) => (
                    <div
                      key={`wg-${i}`}
                      className="absolute top-5 bottom-0 w-px bg-gray-200"
                      style={{ left: wl.x }}
                    />
                  ))}
                  {/* TODAY line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: todayX }}
                  >
                    <span className="absolute top-0 left-1 text-[9px] text-red-500 font-bold">
                      TODAY
                    </span>
                  </div>
                </div>
              </div>

              {/* Project groups */}
              {sortedProjects.map((project) => {
                const progress = calculateProgress(project.id);
                const projectTasks = tasks
                  .filter((t) => t.projectId === project.id)
                  .sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    return (
                      (a.deadline ? new Date(a.deadline).getTime() : 9e15) -
                      (b.deadline ? new Date(b.deadline).getTime() : 9e15)
                    );
                  });

                return (
                  <div key={project.id} className="border-b-2 border-gray-200">
                    {/* Project header row */}
                    <div className="flex bg-emerald-50 border-b border-emerald-200">
                      {/* Left: project info */}
                      <div
                        style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                        className="flex-shrink-0 sticky left-0 z-20 bg-emerald-50 border-r border-emerald-200 px-3 py-2"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-300 px-1.5 py-0.5 rounded">
                            {project.machineNumber}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {project.projectName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex-1 bg-white rounded-full h-1.5 border border-emerald-200">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress === 100 ? "bg-emerald-500" : "bg-teal-400"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700">{progress}%</span>
                        </div>
                      </div>
                      {/* Right: project Gantt row */}
                      <div
                        style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH, height: 56 }}
                        className="flex-shrink-0 relative"
                      >
                        {weekLabels.map((wl, i) => (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-emerald-100"
                            style={{ left: wl.x }}
                          />
                        ))}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-200"
                          style={{ left: todayX }}
                        />
                        {/* Delivery date marker */}
                        {project.deliveryDate && (
                          <div
                            className="absolute flex flex-col items-center z-20"
                            style={{
                              left: dateToX(project.deliveryDate),
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <div className="w-4 h-4 rotate-45 bg-teal-600 border-2 border-white shadow-md" />
                            <span className="text-[9px] text-teal-800 font-bold whitespace-nowrap mt-0.5 bg-white/90 px-1 rounded shadow-sm">
                              {project.deliveryDate}
                            </span>
                          </div>
                        )}
                        {/* Customer label */}
                        {project.customer && (
                          <div className="absolute left-2 bottom-1 text-[9px] text-emerald-600 font-medium">
                            {project.customer}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Task rows */}
                    {projectTasks.length === 0 ? (
                      <div className="flex border-b border-gray-100">
                        <div
                          style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                          className="flex-shrink-0 sticky left-0 bg-white border-r border-gray-100 px-3 h-8 flex items-center text-xs text-gray-300 italic"
                        >
                          タスクなし
                        </div>
                        <div
                          style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH, height: 32 }}
                          className="flex-shrink-0 relative"
                        >
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-100"
                            style={{ left: todayX }}
                          />
                        </div>
                      </div>
                    ) : (
                      projectTasks.map((task) => {
                        const colors = getBarColors(task.deadline, task.completed);
                        const taskX = task.deadline ? dateToX(task.deadline) : null;
                        return (
                          <div
                            key={task.id}
                            className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            {/* Left: task name */}
                            <div
                              style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                              className={`flex-shrink-0 sticky left-0 z-10 border-r border-gray-100 px-3 h-9 flex items-center gap-1.5 ${
                                task.completed ? "bg-gray-50" : "bg-white"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  task.completed ? "bg-emerald-400" : "bg-gray-300"
                                }`}
                              />
                              <span
                                className={`text-xs truncate ${
                                  task.completed
                                    ? "line-through text-gray-400"
                                    : "text-gray-700"
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                            {/* Right: Gantt bar */}
                            <div
                              style={{
                                width: CHART_WIDTH,
                                minWidth: CHART_WIDTH,
                                height: 36,
                              }}
                              className="flex-shrink-0 relative"
                            >
                              {weekLabels.map((wl, i) => (
                                <div
                                  key={i}
                                  className="absolute top-0 bottom-0 w-px bg-gray-100"
                                  style={{ left: wl.x }}
                                />
                              ))}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-100"
                                style={{ left: todayX }}
                              />
                              {taskX !== null ? (
                                <>
                                  {/* Bar from left to deadline */}
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-r-full opacity-75 ${colors.bar}`}
                                    style={{ left: 0, width: Math.min(taskX, CHART_WIDTH) }}
                                  />
                                  {/* Deadline diamond marker */}
                                  <div
                                    className={`absolute w-3 h-3 border-2 border-white shadow-sm z-20 ${colors.marker}`}
                                    style={{
                                      left: taskX,
                                      top: "50%",
                                      transform: "translate(-50%, -50%) rotate(45deg)",
                                    }}
                                  />
                                  {/* Date label */}
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 z-20 text-[9px] font-semibold whitespace-nowrap pl-2 ${colors.label}`}
                                    style={{ left: taskX }}
                                  >
                                    {task.deadline?.slice(5)}
                                  </div>
                                </>
                              ) : (
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 italic">
                                  期限未設定
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
