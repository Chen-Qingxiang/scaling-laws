(() => {
  "use strict";

  const colors = {
    teal: "#0f766e",
    blue: "#2563eb",
    orange: "#d97706",
    red: "#dc2626",
    violet: "#7c3aed",
    gray: "#475569",
    ink: "#17202a",
    grid: "#d8dde7",
  };

  const animalMarkers = [
    { name: "mouse", x: 0.02 },
    { name: "rat", x: 0.3 },
    { name: "rabbit", x: 2 },
    { name: "cat", x: 4 },
    { name: "human", x: 70 },
    { name: "horse", x: 500 },
    { name: "elephant", x: 5000 },
  ];

  const cityPresets = {
    infrastructure: {
      beta: 0.85,
      text: "Infrastructure-like sublinear scaling: larger systems need proportionally less per unit.",
    },
    linear: {
      beta: 1,
      text: "Linear scaling: total Y changes in proportion to system size N.",
    },
    output: {
      beta: 1.15,
      text: "Superlinear socioeconomic-style scaling: larger systems produce proportionally more per unit.",
    },
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    beta: $("betaInput"),
    betaValue: $("betaValue"),
    y0: $("y0Input"),
    mMin: $("mMinInput"),
    mMax: $("mMaxInput"),
    points: $("pointsInput"),
    pointsValue: $("pointsValue"),
    currentFormula: $("currentFormula"),
    explorerCanvas: $("explorerCanvas"),
    exponentMeaning: $("exponentMeaning"),
    logCanvas: $("logCanvas"),
    logSlopeValue: $("logSlopeValue"),
    showAllometryLinear: $("showAllometryLinear"),
    showAllometrySurface: $("showAllometrySurface"),
    showAllometryMetabolic: $("showAllometryMetabolic"),
    showAnimalMarkers: $("showAnimalMarkers"),
    allometryCanvas: $("allometryCanvas"),
    cityPreset: $("cityPreset"),
    cityBeta: $("cityBetaInput"),
    cityBetaValue: $("cityBetaValue"),
    cityNMin: $("cityNMinInput"),
    cityNMax: $("cityNMaxInput"),
    cityFormula: $("cityFormula"),
    cityCanvas: $("cityCanvas"),
    cityInterpretation: $("cityInterpretation"),
    calcBeta: $("calcBetaInput"),
    calcBetaValue: $("calcBetaValue"),
    scaleFactor: $("scaleFactorInput"),
    calculatorOutput: $("calculatorOutput"),
  };

  function powerLaw(x, y0, beta) {
    return y0 * Math.pow(x, beta);
  }

  function generatePowerLawData(minX, maxX, y0, beta, nPoints, logSpacing) {
    const points = [];
    const count = Math.max(2, Math.min(1000, Math.round(nPoints) || 200));
    const min = Math.max(Number(minX) || 1, 1e-12);
    let max = Math.max(Number(maxX) || min * 10, 1e-12);

    if (max <= min) {
      max = min * 10;
    }

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const x = logSpacing
        ? min * Math.pow(max / min, t)
        : min + (max - min) * t;
      points.push({ x, y: powerLaw(x, y0, beta) });
    }

    return points;
  }

  function log10Safe(x) {
    return Number.isFinite(x) && x > 0 ? Math.log10(x) : null;
  }

  function transformLinear(value, min, max, start, end) {
    if (max === min) return (start + end) / 2;
    return start + ((value - min) / (max - min)) * (end - start);
  }

  function transformLogLog(value, minLog, maxLog, start, end) {
    const logged = log10Safe(value);
    if (logged === null) return null;
    return transformLinear(logged, minLog, maxLog, start, end);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "n/a";
    const abs = Math.abs(value);
    if (abs === 0) return "0";
    if (abs >= 1_000_000 || abs < 0.001) return value.toExponential(2);
    if (abs >= 1000) return Math.round(value).toLocaleString("en-US");
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return trimZeros(value.toFixed(1));
    if (abs >= 1) return trimZeros(value.toFixed(2));
    return trimZeros(value.toFixed(3));
  }

  function trimZeros(text) {
    return text.replace(/\.?0+$/, "");
  }

  function formatBeta(value) {
    return trimZeros(Number(value).toFixed(2));
  }

  function readNumber(input, fallback) {
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function getCanvasContext(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, Math.round(rect.width || canvas.clientWidth || 640));
    const height = Math.max(260, Math.round(rect.height || canvas.clientHeight || 320));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function isValidPoint(point, xScale, yScale) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    if (xScale === "log" && point.x <= 0) return false;
    if (yScale === "log" && point.y <= 0) return false;
    return true;
  }

  function scaledValue(value, scale) {
    return scale === "log" ? log10Safe(value) : value;
  }

  function buildDomain(values, scale, explicitMin, explicitMax, includeZero, padRatio) {
    let minRaw = Number.isFinite(explicitMin) ? explicitMin : Math.min(...values);
    let maxRaw = Number.isFinite(explicitMax) ? explicitMax : Math.max(...values);

    if (scale === "log") {
      const positive = values.filter((value) => value > 0);
      if (minRaw <= 0 || !Number.isFinite(minRaw)) minRaw = Math.min(...positive);
      if (maxRaw <= 0 || !Number.isFinite(maxRaw)) maxRaw = Math.max(...positive);
    }

    if (includeZero && scale === "linear" && minRaw > 0) {
      minRaw = 0;
    }

    let min = scaledValue(minRaw, scale);
    let max = scaledValue(maxRaw, scale);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }

    if (min === max) {
      const delta = Math.abs(min || 1) * 0.1;
      min -= delta;
      max += delta;
    }

    const pad = (max - min) * padRatio;
    return { min: min - pad, max: max + pad };
  }

  function niceStep(rawStep) {
    const exponent = Math.floor(Math.log10(rawStep));
    const fraction = rawStep / Math.pow(10, exponent);
    let niceFraction = 1;

    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;

    return niceFraction * Math.pow(10, exponent);
  }

  function makeLinearTicks(min, max, count) {
    const step = niceStep((max - min) / Math.max(1, count - 1));
    const first = Math.ceil(min / step) * step;
    const ticks = [];

    for (let value = first; value <= max + step * 0.5; value += step) {
      if (value >= min - step * 0.5) {
        ticks.push({ value, label: formatNumber(value) });
      }
      if (ticks.length > 8) break;
    }

    return ticks;
  }

  function makeLogTicks(minLog, maxLog) {
    const ticks = [];
    const start = Math.ceil(minLog);
    const end = Math.floor(maxLog);

    for (let exponent = start; exponent <= end; exponent += 1) {
      ticks.push({ value: exponent, label: formatNumber(Math.pow(10, exponent)) });
    }

    if (ticks.length >= 3) return ticks;

    const step = niceStep((maxLog - minLog) / 4);
    const first = Math.ceil(minLog / step) * step;
    for (let value = first; value <= maxLog + step * 0.5; value += step) {
      ticks.push({ value, label: formatNumber(Math.pow(10, value)) });
      if (ticks.length > 6) break;
    }

    return ticks;
  }

  function makeTicks(domain, scale, count) {
    return scale === "log"
      ? makeLogTicks(domain.min, domain.max)
      : makeLinearTicks(domain.min, domain.max, count);
  }

  function drawAxes(ctx, plot, xTicks, yTicks, options) {
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.fillStyle = colors.gray;
    ctx.lineWidth = 1;
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";

    yTicks.forEach((tick) => {
      const y = transformLinear(tick.value, options.yDomain.min, options.yDomain.max, plot.bottom, plot.top);
      ctx.beginPath();
      ctx.moveTo(plot.left, y);
      ctx.lineTo(plot.right, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(tick.label, plot.left - 9, y);
    });

    xTicks.forEach((tick) => {
      const x = transformLinear(tick.value, options.xDomain.min, options.xDomain.max, plot.left, plot.right);
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(tick.label, x, plot.bottom + 20);
    });

    ctx.strokeStyle = "#9aa5b3";
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.bottom);
    ctx.stroke();

    ctx.fillStyle = colors.ink;
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(options.xLabel, (plot.left + plot.right) / 2, plot.bottom + 42);

    ctx.save();
    ctx.translate(18, (plot.top + plot.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(options.yLabel, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  function drawPlot(canvas, dataSeries, options = {}) {
    const { ctx, width, height } = getCanvasContext(canvas);
    const xScale = options.xScale || "linear";
    const yScale = options.yScale || "linear";
    const plot = {
      left: 62,
      right: width - 22,
      top: 24,
      bottom: height - 54,
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfcff";
    ctx.fillRect(0, 0, width, height);

    const series = dataSeries.filter((item) => item && item.visible !== false);
    const validPoints = series
      .flatMap((item) => item.points || [])
      .filter((point) => isValidPoint(point, xScale, yScale));

    if (!validPoints.length) {
      ctx.fillStyle = colors.gray;
      ctx.font = "15px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No positive values to plot.", width / 2, height / 2);
      return;
    }

    const xValues = validPoints.map((point) => point.x);
    const yValues = validPoints.map((point) => point.y);
    const xDomain = buildDomain(xValues, xScale, options.xMin, options.xMax, false, 0.02);
    const yDomain = buildDomain(yValues, yScale, options.yMin, options.yMax, options.includeZeroY, 0.06);
    const xTicks = makeTicks(xDomain, xScale, 5);
    const yTicks = makeTicks(yDomain, yScale, 5);

    drawAxes(ctx, plot, xTicks, yTicks, {
      xDomain,
      yDomain,
      xLabel: options.xLabel || "x",
      yLabel: options.yLabel || "y",
    });

    const toX = (value) => {
      if (xScale === "log") {
        return transformLogLog(value, xDomain.min, xDomain.max, plot.left, plot.right);
      }
      return transformLinear(value, xDomain.min, xDomain.max, plot.left, plot.right);
    };

    const toY = (value) => {
      if (yScale === "log") {
        return transformLogLog(value, yDomain.min, yDomain.max, plot.bottom, plot.top);
      }
      return transformLinear(value, yDomain.min, yDomain.max, plot.bottom, plot.top);
    };

    if (options.slopeGuide) {
      drawSlopeGuide(ctx, plot, xDomain, yDomain, options.slopeGuide);
    }

    series.forEach((item) => {
      const points = (item.points || []).filter((point) => isValidPoint(point, xScale, yScale));
      if (!points.length) return;

      ctx.save();
      ctx.strokeStyle = item.color || colors.teal;
      ctx.fillStyle = item.color || colors.teal;
      ctx.lineWidth = item.lineWidth || 2.5;
      ctx.setLineDash(item.dash || []);

      if (item.line !== false) {
        ctx.beginPath();
        points.forEach((point, index) => {
          const x = toX(point.x);
          const y = toY(point.y);
          if (x === null || y === null) return;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      if (item.markers || item.markerOnly) {
        points.forEach((point) => {
          const x = toX(point.x);
          const y = toY(point.y);
          if (x === null || y === null) return;

          ctx.beginPath();
          ctx.arc(x, y, item.radius || 4, 0, Math.PI * 2);
          ctx.fill();

          if (item.labels && point.label) {
            ctx.fillStyle = colors.ink;
            ctx.font = "11px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(point.label, x + 6, y - 7);
            ctx.fillStyle = item.color || colors.teal;
          }
        });
      }

      ctx.restore();
    });

    if (options.legend !== false && series.length > 1) {
      drawLegend(ctx, plot, series);
    }
  }

  function drawSlopeGuide(ctx, plot, xDomain, yDomain, guide) {
    const beta = guide.beta;
    const xRange = xDomain.max - xDomain.min;
    const yRange = yDomain.max - yDomain.min;
    const sx1 = xDomain.min + xRange * 0.14;
    const sx2 = xDomain.min + xRange * 0.36;
    let sy1 = yDomain.min + yRange * 0.18;
    let sy2 = sy1 + beta * (sx2 - sx1);

    if (sy2 > yDomain.max - yRange * 0.08) {
      sy2 = yDomain.max - yRange * 0.08;
      sy1 = sy2 - beta * (sx2 - sx1);
    }

    const x1 = transformLinear(sx1, xDomain.min, xDomain.max, plot.left, plot.right);
    const x2 = transformLinear(sx2, xDomain.min, xDomain.max, plot.left, plot.right);
    const y1 = transformLinear(sy1, yDomain.min, yDomain.max, plot.bottom, plot.top);
    const y2 = transformLinear(sy2, yDomain.min, yDomain.max, plot.bottom, plot.top);

    ctx.save();
    ctx.strokeStyle = guide.color || colors.red;
    ctx.fillStyle = guide.color || colors.red;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`slope = β = ${formatBeta(beta)}`, x2 + 8, y2);
    ctx.restore();
  }

  function drawLegend(ctx, plot, series) {
    const items = series.filter((item) => item.name);
    if (!items.length) return;

    const lineHeight = 18;
    const width = Math.min(230, plot.right - plot.left - 20);
    const height = items.length * lineHeight + 12;
    const x = plot.right - width - 8;
    const y = plot.top + 8;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    items.forEach((item, index) => {
      const itemY = y + 10 + index * lineHeight;
      ctx.strokeStyle = item.color || colors.teal;
      ctx.fillStyle = item.color || colors.teal;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(item.dash || []);
      ctx.beginPath();
      ctx.moveTo(x + 10, itemY);
      ctx.lineTo(x + 30, itemY);
      ctx.stroke();
      ctx.setLineDash([]);
      if (item.markerOnly) {
        ctx.beginPath();
        ctx.arc(x + 20, itemY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = colors.ink;
      ctx.fillText(item.name, x + 38, itemY);
    });

    ctx.restore();
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function getExplorerSettings() {
    const beta = readNumber(els.beta, 0.75);
    const y0 = Math.max(0.0001, readNumber(els.y0, 1));
    const mMin = Math.max(1e-9, readNumber(els.mMin, 1));
    let mMax = Math.max(1e-8, readNumber(els.mMax, 1000));
    const points = Math.max(20, Math.min(600, readNumber(els.points, 200)));
    const scale = document.querySelector("input[name='plotScale']:checked")?.value || "linear";

    if (mMax <= mMin) mMax = mMin * 10;
    return { beta, y0, mMin, mMax, points, scale };
  }

  function classifyBeta(beta) {
    if (beta < 0.98) return "sublinear";
    if (beta > 1.02) return "superlinear";
    return "linear";
  }

  function colorForBeta(beta) {
    if (beta < 0.98) return colors.teal;
    if (beta > 1.02) return colors.red;
    return colors.blue;
  }

  function updateFormula(settings) {
    els.betaValue.textContent = formatBeta(settings.beta);
    els.pointsValue.textContent = String(Math.round(settings.points));
    els.currentFormula.innerHTML = `Y = ${formatNumber(settings.y0)} * M<sup>${formatBeta(settings.beta)}</sup>`;

    const className = classifyBeta(settings.beta);
    const doubleMultiplier = Math.pow(2, settings.beta);
    els.exponentMeaning.textContent =
      `Current β is ${formatBeta(settings.beta)}, so this is ${className} scaling. ` +
      `A 2x increase in M multiplies Y by about ${formatNumber(doubleMultiplier)}.`;
  }

  function renderPowerLawExplorer() {
    const settings = getExplorerSettings();
    updateFormula(settings);

    const useLogAxes = settings.scale === "loglog";
    const data = generatePowerLawData(
      settings.mMin,
      settings.mMax,
      settings.y0,
      settings.beta,
      settings.points,
      true
    );

    drawPlot(
      els.explorerCanvas,
      [
        {
          name: `β = ${formatBeta(settings.beta)}`,
          color: colorForBeta(settings.beta),
          points: data,
        },
      ],
      {
        xScale: useLogAxes ? "log" : "linear",
        yScale: useLogAxes ? "log" : "linear",
        xLabel: "M (scale)",
        yLabel: "Y",
        includeZeroY: !useLogAxes,
        legend: false,
      }
    );
  }

  function renderLogLogView() {
    const settings = getExplorerSettings();
    const data = generatePowerLawData(
      settings.mMin,
      settings.mMax,
      settings.y0,
      settings.beta,
      settings.points,
      true
    );

    els.logSlopeValue.textContent = formatBeta(settings.beta);
    drawPlot(
      els.logCanvas,
      [
        {
          name: `power law, β = ${formatBeta(settings.beta)}`,
          color: colorForBeta(settings.beta),
          points: data,
        },
      ],
      {
        xScale: "log",
        yScale: "log",
        xLabel: "log scale for M",
        yLabel: "log scale for Y",
        slopeGuide: { beta: settings.beta, color: colors.red },
        legend: false,
      }
    );
  }

  function renderAllometryComparison() {
    const series = [];
    const minM = 0.01;
    const maxM = 10000;
    const pointCount = 240;

    if (els.showAllometryLinear.checked) {
      series.push({
        name: "β = 1 linear",
        color: colors.blue,
        points: generatePowerLawData(minM, maxM, 1, 1, pointCount, true),
      });
    }

    if (els.showAllometrySurface.checked) {
      series.push({
        name: "β = 2/3 surface-like",
        color: colors.orange,
        points: generatePowerLawData(minM, maxM, 1, 2 / 3, pointCount, true),
      });
    }

    if (els.showAllometryMetabolic.checked) {
      series.push({
        name: "β = 3/4 metabolic",
        color: colors.teal,
        points: generatePowerLawData(minM, maxM, 1, 0.75, pointCount, true),
      });
    }

    if (els.showAnimalMarkers.checked) {
      series.push({
        name: "illustrative animal masses",
        color: colors.ink,
        line: false,
        markerOnly: true,
        markers: true,
        labels: true,
        radius: 3.6,
        points: animalMarkers.map((item) => ({
          x: item.x,
          y: powerLaw(item.x, 1, 0.75),
          label: item.name,
        })),
      });
    }

    drawPlot(els.allometryCanvas, series, {
      xScale: "log",
      yScale: "log",
      xLabel: "body mass M (kg, illustrative)",
      yLabel: "relative quantity",
      legend: true,
    });
  }

  function renderCityScalingComparison() {
    const beta = readNumber(els.cityBeta, 1.15);
    const nMin = Math.max(1, readNumber(els.cityNMin, 10000));
    let nMax = Math.max(2, readNumber(els.cityNMax, 10000000));
    if (nMax <= nMin) nMax = nMin * 10;

    const data = generatePowerLawData(nMin, nMax, 1, beta, 220, true);
    const series = [
      {
        name: `selected β = ${formatBeta(beta)}`,
        color: colorForBeta(beta),
        points: data,
      },
    ];

    if (Math.abs(beta - 1) > 0.02) {
      series.push({
        name: "linear reference, β = 1",
        color: colors.gray,
        dash: [6, 4],
        points: generatePowerLawData(nMin, nMax, 1, 1, 220, true),
      });
    }

    els.cityBetaValue.textContent = formatBeta(beta);
    els.cityFormula.innerHTML = `Y = 1 * N<sup>${formatBeta(beta)}</sup>`;

    const presetText = cityPresets[els.cityPreset.value]?.text;
    const fallbackText =
      beta < 0.98
        ? "Custom sublinear scaling: Y grows more slowly than system size N."
        : beta > 1.02
          ? "Custom superlinear scaling: Y grows faster than system size N."
          : "Custom near-linear scaling: Y changes roughly in proportion to system size N.";
    els.cityInterpretation.textContent = presetText || fallbackText;

    drawPlot(els.cityCanvas, series, {
      xScale: "log",
      yScale: "log",
      xLabel: "system size N",
      yLabel: "Y (relative)",
      legend: true,
    });
  }

  function updateDoublingCalculator() {
    const beta = readNumber(els.calcBeta, 0.75);
    const scaleFactor = Math.max(0.0001, readNumber(els.scaleFactor, 2));
    const multiplier = Math.pow(scaleFactor, beta);

    els.calcBetaValue.textContent = formatBeta(beta);
    els.calculatorOutput.textContent =
      `${formatNumber(scaleFactor)}^${formatBeta(beta)} = ${formatNumber(multiplier)}`;
  }

  function renderAll() {
    renderPowerLawExplorer();
    renderLogLogView();
    renderAllometryComparison();
    renderCityScalingComparison();
    updateDoublingCalculator();
  }

  function scheduleRender() {
    if (scheduleRender.frame) cancelAnimationFrame(scheduleRender.frame);
    scheduleRender.frame = requestAnimationFrame(renderAll);
  }

  function bindEvents() {
    [els.beta, els.y0, els.mMin, els.mMax, els.points].forEach((input) => {
      input.addEventListener("input", scheduleRender);
    });

    document.querySelectorAll("input[name='plotScale']").forEach((input) => {
      input.addEventListener("change", scheduleRender);
    });

    document.querySelectorAll("[data-explorer-beta]").forEach((button) => {
      button.addEventListener("click", () => {
        els.beta.value = button.dataset.explorerBeta;
        scheduleRender();
      });
    });

    [
      els.showAllometryLinear,
      els.showAllometrySurface,
      els.showAllometryMetabolic,
      els.showAnimalMarkers,
    ].forEach((input) => input.addEventListener("change", renderAllometryComparison));

    els.cityPreset.addEventListener("change", () => {
      const preset = cityPresets[els.cityPreset.value];
      if (preset) {
        els.cityBeta.value = String(preset.beta);
      }
      renderCityScalingComparison();
    });

    [els.cityBeta, els.cityNMin, els.cityNMax].forEach((input) => {
      input.addEventListener("input", () => {
        if (input === els.cityBeta) {
          const matchedPreset = Object.entries(cityPresets).find(([, preset]) => {
            return Math.abs(preset.beta - Number(els.cityBeta.value)) < 0.001;
          });
          els.cityPreset.value = matchedPreset ? matchedPreset[0] : "custom";
        }
        renderCityScalingComparison();
      });
    });

    [els.calcBeta, els.scaleFactor].forEach((input) => {
      input.addEventListener("input", updateDoublingCalculator);
    });

    window.addEventListener("resize", scheduleRender);
  }

  bindEvents();
  renderAll();
})();
