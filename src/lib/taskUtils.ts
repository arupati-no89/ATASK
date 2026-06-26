// App.tsx から切り出した純粋関数群（state・Firestoreに依存しない）。
// すべて引数だけで結果が決まる。UI・副作用は App 側に残す。

// タスク名と納入日から推奨期限(YYYY-MM-DD)を算出する
export const calculateSuggestedDeadline = (title, deliveryDateStr) => {
  if (!deliveryDateStr) return "";
  const deliveryDate = new Date(deliveryDateStr);
  if (isNaN(deliveryDate as unknown as number)) return "";

  let offsetDays = -3;
  if (title.match(/手配|注文|見積|発注/)) offsetDays = -30;
  else if (title.match(/設計|作図|計画/)) offsetDays = -20;
  else if (title.match(/準備|確認|リスト/)) offsetDays = -7;
  else if (title.match(/報告|請求/)) offsetDays = 3;

  deliveryDate.setDate(deliveryDate.getDate() + offsetDays);
  const yyyy = deliveryDate.getFullYear();
  const mm = String(deliveryDate.getMonth() + 1).padStart(2, "0");
  const dd = String(deliveryDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// 期限から状態(色分け用)を判定する: normal / urgent / overdue
export const getDeadlineStatus = (deadlineStr, isCompleted) => {
  if (!deadlineStr || isCompleted) return "normal";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadlineStr);
  deadlineDate.setHours(0, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue"; // 過去（期限切れ）
  if (diffDays <= 3) return "urgent"; // 3日以内（期限間近）
  return "normal";
};

// getDeadlineStatus の結果に対応する Tailwind クラスを返す
export const getDeadlineColorClass = (status) => {
  if (status === "overdue")
    return "text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded";
  if (status === "urgent")
    return "text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded";
  return "text-gray-500";
};

// 工事案件＋タスク＋サブタスクから Excel貼り付け用 TSV 文字列を生成する。
// クリップボード書き込み・通知は呼び出し側(App)で行う。
export const buildProjectTsv = (project, tasks, subTasks) => {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  let tsv = `階層\t項目名\t期限\t状態\t備考\n`;
  tsv += `1\t[工事] ${project.machineNumber} ${project.projectName}\t${project.deliveryDate}\t${project.status}\t${project.customer}\n`;

  projectTasks.forEach((task) => {
    const taskStatus = task.completed ? "完了" : "未完了";
    const taskMemo = task.memo
      ? ` [メモ: ${task.memo.replace(/\n/g, " ")}]`
      : "";
    tsv += `2\t${task.title}\t${task.deadline || "-"}\t${taskStatus}\t${
      task.priority === "High" ? "優先度:高" : ""
    }${taskMemo}\n`;

    const relatedSubTasks = subTasks.filter((st) => st.taskId === task.id);
    relatedSubTasks.forEach((st) => {
      const stStatus = st.completed ? "完了" : "未完了";
      const stMemo = st.memo ? ` [メモ: ${st.memo.replace(/\n/g, " ")}]` : "";
      tsv += `3\t    - ${st.title}\t${
        st.deadline || "-"
      }\t${stStatus}\t${stMemo}\n`;
    });
  });

  return tsv;
};
