<?php
// Router untuk server pengembangan PHP bawaan: php -S localhost:8766 tools/dev-router.php
// Meniru aturan .htaccess di produksi: /api/* → api/index.php, sisanya berkas statis.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api(/|$)#', $path)) {
    require __DIR__ . '/../api/index.php';
    return true;
}
if (preg_match('#^/(docs|api|tools)/|\.(md|sql)$|/\.#', $path)) {
    http_response_code(403);
    return true;
}
return false;
