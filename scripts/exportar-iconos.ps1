# Exportación determinista del diseño aprobado; no requiere dependencias npm.
Add-Type -AssemblyName System.Drawing
$raizProyecto = Split-Path $PSScriptRoot -Parent
$directorio = Join-Path $raizProyecto 'public/iconos'
$fuente = [System.Drawing.Bitmap]::FromFile((Join-Path $directorio 'pignus-maestro.png'))
try {
    foreach ($tamano in @(16,32,48,180,192,512)) {
        $bitmap = [System.Drawing.Bitmap]::new($tamano,$tamano)
        $grafico = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $grafico.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $grafico.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $grafico.DrawImage($fuente,0,0,$tamano,$tamano)
            $bitmap.Save((Join-Path $directorio "pignus-$tamano.png"),[System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $grafico.Dispose(); $bitmap.Dispose() }
    }
    # Reducir la exportación dentro del lienzo, dejando zona segura para máscaras.
    $bitmap = [System.Drawing.Bitmap]::new(512,512)
    $grafico = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $grafico.Clear($fuente.GetPixel(0,0))
        $grafico.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $grafico.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $grafico.DrawImage($fuente,51,51,410,410)
        $bitmap.Save((Join-Path $directorio 'pignus-maskable-512.png'),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $grafico.Dispose(); $bitmap.Dispose() }
    # ICO con tres resoluciones PNG, compatibles con navegadores actuales.
    $flujo = [System.IO.File]::Create((Join-Path $raizProyecto 'public/favicon.ico'))
    $escritor = [System.IO.BinaryWriter]::new($flujo)
    try {
        $escritor.Write([uint16]0); $escritor.Write([uint16]1); $escritor.Write([uint16]3)
        $desplazamiento = 6 + 3 * 16
        foreach ($tamano in @(16,32,48)) {
            $bytes = [System.IO.File]::ReadAllBytes((Join-Path $directorio "pignus-$tamano.png"))
            $escritor.Write([byte]$tamano); $escritor.Write([byte]$tamano)
            $escritor.Write([byte]0); $escritor.Write([byte]0)
            $escritor.Write([uint16]1); $escritor.Write([uint16]32)
            $escritor.Write([uint32]$bytes.Length); $escritor.Write([uint32]$desplazamiento)
            $desplazamiento += $bytes.Length
        }
        foreach ($tamano in @(16,32,48)) {
            $escritor.Write([System.IO.File]::ReadAllBytes((Join-Path $directorio "pignus-$tamano.png")))
        }
    } finally { $escritor.Dispose(); $flujo.Dispose() }
    Copy-Item -LiteralPath (Join-Path $directorio 'pignus-180.png') -Destination (Join-Path $raizProyecto 'public/apple-touch-icon.png')
} finally { $fuente.Dispose() }
