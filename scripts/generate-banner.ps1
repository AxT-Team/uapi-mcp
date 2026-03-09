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
$titleFont = $null
$titleBrush = $null
$shadowBrush = $null
$stringFormat = $null

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

  $titleFont = New-Object System.Drawing.Font('Segoe UI', ($height * 0.145), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(76, 0, 0, 0))
  $titleRect = New-Object System.Drawing.RectangleF(0, ($height * 0.41), $width, ($height * 0.16))
  $titleBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $titleRect,
    [System.Drawing.Color]::FromArgb(255, 230, 214, 176),
    [System.Drawing.Color]::FromArgb(255, 240, 210, 226),
    0.0
  )

  $stringFormat = [System.Drawing.StringFormat]::GenericTypographic
  $stringFormat.Alignment = [System.Drawing.StringAlignment]::Near
  $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Near

  $titleText = 'Uapi Mcp'
  $titleSize = $graphics.MeasureString($titleText, $titleFont, 2400, $stringFormat)
  $titleX = ($width - $titleSize.Width) / 2
  $titleY = $height * 0.405

  $graphics.DrawString($titleText, $titleFont, $shadowBrush, ($titleX + 3), ($titleY + 6), $stringFormat)
  $graphics.DrawString($titleText, $titleFont, $titleBrush, $titleX, $titleY, $stringFormat)

  $outputFullPath = Resolve-Path (Split-Path $OutputPath -Parent) -ErrorAction SilentlyContinue
  if (-not $outputFullPath) {
    New-Item -ItemType Directory -Path (Split-Path $OutputPath -Parent) -Force | Out-Null
  }

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Banner generated: $OutputPath"
}
finally {
  if ($stringFormat) { $stringFormat.Dispose() }
  if ($shadowBrush) { $shadowBrush.Dispose() }
  if ($titleBrush) { $titleBrush.Dispose() }
  if ($titleFont) { $titleFont.Dispose() }
  if ($graphics) { $graphics.Dispose() }
  if ($bitmap) { $bitmap.Dispose() }
  if ($background) { $background.Dispose() }
}
