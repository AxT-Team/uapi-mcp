param(
  [string]$BackgroundPath,
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\banner.png')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $BackgroundPath) {
  $defaultBackground = Join-Path $PSScriptRoot '..\..\..\uapipro-client\Programming_Language_Backgrounds_All\Javascript.png'
  if (Test-Path $defaultBackground) {
    $BackgroundPath = $defaultBackground
  }
}

if (-not $BackgroundPath -or -not (Test-Path $BackgroundPath)) {
  throw "Background image not found. Pass -BackgroundPath, or make sure ../uapipro-client/Programming_Language_Backgrounds_All/Javascript.png exists."
}

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$background = $null
$bitmap = $null
$graphics = $null
$brandFont = $null
$labelFont = $null
$badgeFont = $null
$brandBrush = $null
$labelBrush = $null
$shadowBrush = $null
$badgeBrush = $null
$badgeTextBrush = $null
$outlinePen = $null
$stringFormat = $null
$badgePath = $null

try {
  $background = [System.Drawing.Image]::FromFile((Resolve-Path $BackgroundPath))
  $bitmap = New-Object System.Drawing.Bitmap($background.Width, $background.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.DrawImage($background, 0, 0, $background.Width, $background.Height)

  $width = [float]$background.Width
  $height = [float]$background.Height

  $brandFont = New-Object System.Drawing.Font('Segoe UI', ($height * 0.085), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $labelFont = New-Object System.Drawing.Font('Segoe UI', ($height * 0.13), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $badgeFont = New-Object System.Drawing.Font('Segoe UI', ($height * 0.052), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

  $brandBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(228, 234, 214, 160))
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(76, 0, 0, 0))
  $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 230, 210, 164))
  $badgeTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 35, 35, 35))
  $labelRect = New-Object System.Drawing.RectangleF(0, ($height * 0.50), $width, ($height * 0.22))
  $labelBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $labelRect,
    [System.Drawing.Color]::FromArgb(255, 230, 214, 176),
    [System.Drawing.Color]::FromArgb(255, 240, 210, 226),
    0.0
  )
  $outlinePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(28, 255, 255, 255), 1.4)

  $stringFormat = [System.Drawing.StringFormat]::GenericTypographic
  $stringFormat.Alignment = [System.Drawing.StringAlignment]::Near
  $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Near

  $brandText = 'Uapi'
  $labelText = 'Mcp Server'
  $badgeText = 'MCP'

  $brandSize = $graphics.MeasureString($brandText, $brandFont, 2000, $stringFormat)
  $badgeTextSize = $graphics.MeasureString($badgeText, $badgeFont, 2000, $stringFormat)

  $lineGap = $width * 0.018
  $badgePaddingX = $width * 0.02
  $badgePaddingY = $height * 0.016
  $badgeWidth = [Math]::Ceiling($badgeTextSize.Width + ($badgePaddingX * 2))
  $badgeHeight = [Math]::Ceiling($badgeTextSize.Height + ($badgePaddingY * 2))
  $lineWidth = $brandSize.Width + $lineGap + $badgeWidth

  $line1X = ($width - $lineWidth) / 2
  $line1Y = $height * 0.36
  $badgeX = $line1X + $brandSize.Width + $lineGap
  $badgeY = $line1Y + (($brandSize.Height - $badgeHeight) / 2) + ($height * 0.008)

  $graphics.DrawString($brandText, $brandFont, $shadowBrush, ($line1X + 2), ($line1Y + 4), $stringFormat)
  $graphics.DrawString($brandText, $brandFont, $brandBrush, $line1X, $line1Y, $stringFormat)

  $badgeRect = New-Object System.Drawing.RectangleF($badgeX, $badgeY, $badgeWidth, $badgeHeight)
  $badgePath = New-RoundedRectanglePath -Rectangle $badgeRect -Radius ($height * 0.018)
  $graphics.FillPath($badgeBrush, $badgePath)
  $graphics.DrawPath($outlinePen, $badgePath)

  $badgeTextX = $badgeX + (($badgeWidth - $badgeTextSize.Width) / 2)
  $badgeTextY = $badgeY + (($badgeHeight - $badgeTextSize.Height) / 2) - ($height * 0.002)
  $graphics.DrawString($badgeText, $badgeFont, $badgeTextBrush, $badgeTextX, $badgeTextY, $stringFormat)

  $labelSize = $graphics.MeasureString($labelText, $labelFont, 2400, $stringFormat)
  $labelX = ($width - $labelSize.Width) / 2
  $labelY = $height * 0.54
  $graphics.DrawString($labelText, $labelFont, $shadowBrush, ($labelX + 3), ($labelY + 6), $stringFormat)
  $graphics.DrawString($labelText, $labelFont, $labelBrush, $labelX, $labelY, $stringFormat)

  $outputFullPath = Resolve-Path (Split-Path $OutputPath -Parent) -ErrorAction SilentlyContinue
  if (-not $outputFullPath) {
    New-Item -ItemType Directory -Path (Split-Path $OutputPath -Parent) -Force | Out-Null
  }

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Banner generated: $OutputPath"
}
finally {
  if ($badgePath) { $badgePath.Dispose() }
  if ($stringFormat) { $stringFormat.Dispose() }
  if ($outlinePen) { $outlinePen.Dispose() }
  if ($badgeTextBrush) { $badgeTextBrush.Dispose() }
  if ($badgeBrush) { $badgeBrush.Dispose() }
  if ($shadowBrush) { $shadowBrush.Dispose() }
  if ($labelBrush) { $labelBrush.Dispose() }
  if ($brandBrush) { $brandBrush.Dispose() }
  if ($badgeFont) { $badgeFont.Dispose() }
  if ($labelFont) { $labelFont.Dispose() }
  if ($brandFont) { $brandFont.Dispose() }
  if ($graphics) { $graphics.Dispose() }
  if ($bitmap) { $bitmap.Dispose() }
  if ($background) { $background.Dispose() }
}
