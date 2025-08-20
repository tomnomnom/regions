<?php
header("content-type: application/json");

$d = json_decode(file_get_contents("save.json"));
echo json_encode($d);
