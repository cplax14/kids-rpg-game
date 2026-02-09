extends CharacterBody2D


@export var speed := 50 #Movement Speed
@onready var anim = $AnimatedSprite2D #Character animation


func _ready():
	#Get map size for the camera limits.
	#------------------------------------------------#
	var tilemap = get_node("/root/Map/TileMap_Ground")
	if tilemap == null:
		print("Tilemap not found!")
		return
	
	var used_rect = tilemap.get_used_rect()
	var tile_size = tilemap.tile_set.tile_size
	
	var map_size_pixels = used_rect.size * tile_size
	var map_position_pixels = used_rect.position * tile_size
	
	var camera = $Camera2D
	camera.limit_left = map_position_pixels.x
	camera.limit_top = map_position_pixels.y
	camera.limit_right = map_position_pixels.x + map_size_pixels.x
	camera.limit_bottom = map_position_pixels.y + map_size_pixels.y
	#------------------------------------------------#

func _physics_process(_delta):
	#Controls
	var input_vector = Vector2.ZERO
	input_vector.x = Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left")
	input_vector.y = Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	input_vector = input_vector.normalized()

	#Movement
	velocity = input_vector * speed
	move_and_slide()

	#Animation Logic
	if input_vector != Vector2.ZERO:
		if input_vector.x != 0:
			anim.animation = "run_right" if input_vector.x > 0 else "run_left"
		else:
			anim.animation = "run_down" if input_vector.y > 0 else "run_up"
	else:
		var current = anim.animation
		if current.begins_with("run"):
			anim.animation = current.replace("run", "idle")

	anim.play()
