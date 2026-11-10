export function renderProgressBarParts(percentage, width = 14) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const filled = Math.round((clamped / 100) * width);
    const empty = Math.max(0, width - filled);
    return {
        filled: "█".repeat(filled),
        empty: "░".repeat(empty),
    };
}
export function renderProgressBar(percentage, width = 14) {
    const parts = renderProgressBarParts(percentage, width);
    return parts.filled + parts.empty;
}
export function computeFullWidthBarSize(containerWidth, progressLabel) {
    return Math.max(4, containerWidth - progressLabel.length - 1);
}
function stepPrefix(status) {
    switch (status) {
        case "completed":
            return "[x]";
        case "active":
            return "[▶]";
        case "next":
        case "pending":
            return "[ ]";
    }
}
function taskIcon(status) {
    switch (status) {
        case "completed":
            return "✓";
        case "active":
            return "▶";
        case "pending":
            return "";
    }
}
export function buildSidebarViewModel(plan, containerWidth = 36) {
    const percentageText = `${plan.percentage}%`;
    const stepsCountText = `(${plan.completedSteps}/${plan.totalSteps})`;
    const progressLabel = `${percentageText} ${stepsCountText}`;
    const barWidth = computeFullWidthBarSize(containerWidth, progressLabel);
    const barParts = renderProgressBarParts(plan.percentage, barWidth);
    const progressBar = barParts.filled + barParts.empty;
    const tasks = plan.tasks.map((task) => {
        const icon = taskIcon(task.status);
        const prefix = icon ? `${icon} ` : "";
        const header = `${prefix}${task.title} (${task.completedSteps}/${task.totalSteps})`;
        const steps = task.steps.map((step) => {
            const stepMarker = stepPrefix(step.status);
            return {
                prefix: stepMarker,
                text: step.text,
                line: `${stepMarker} ${step.text}`,
                status: step.status,
            };
        });
        return {
            id: task.id,
            icon,
            title: task.title,
            header,
            status: task.status,
            steps,
        };
    });
    return {
        headerTitle: plan.title,
        fileName: plan.fileName,
        filePath: plan.filePath,
        progressBar,
        progressBarFilled: barParts.filled,
        progressBarEmpty: barParts.empty,
        progressLabel,
        percentageText,
        stepsCountText,
        percentage: plan.percentage,
        tasks,
    };
}
