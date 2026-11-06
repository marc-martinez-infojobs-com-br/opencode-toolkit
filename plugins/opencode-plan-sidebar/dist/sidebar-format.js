export function renderProgressBar(percentage, width = 14) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const filled = Math.round((clamped / 100) * width);
    const empty = Math.max(0, width - filled);
    return "█".repeat(filled) + "░".repeat(empty);
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
    const progressLabel = `${plan.percentage}% (${plan.completedSteps}/${plan.totalSteps})`;
    const barWidth = computeFullWidthBarSize(containerWidth, progressLabel);
    const progressBar = renderProgressBar(plan.percentage, barWidth);
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
        progressLabel,
        percentage: plan.percentage,
        tasks,
    };
}
