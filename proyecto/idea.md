Winlabs - Analytics (wl-A)
------------------------------------------------

El proyecto consiste en crear una aplicacion de Analytics con distintos origenes de datos(modelos de informacion) que podrian ser: 
	People Analytics (People, Time, Payroll, Recruiting, Learning, Performance) 
	o referente a otros modelos de informacion (finanzas, CRM, ventas, etc)

Quiere hacer algo generico y parametrizable / adaptable a las necesidades de cada cliente. 
Es un proyecto ambicioso pero quiero intentar hacer algo que pueda vender como solucion generica y adaptable a clientes con distintas necesidades 

Hay muchos aspectos que debemos cubrir, desde 
	la arquitectura del proyecto para soportar la idea, 
	Seguramente 2 proyectos asociados (proyecto de aplicacion del cliente, proyecto de administracion de plataforma (console)	
	aspectos de seguridad, 
	stack tecnologico, 
	CI/CD (Hosting y deploy)
	Funcionalidad segun vista (cliente o interna)
	Layout de la aplicacion
	Gestion del proyecto (Roadmap, Seguimiento, parking lot, Mejoras, Iniciativas)
	etc	


La aplicacion debe tener (+)
------------------------
	* Dashboards 
		- configurables y Taylor made
		- IA Driven
		- Niveles de granularidad (detalles), el dashboard debe tener paragina de detalle asociada donde muestre origen de la info e insigths (IA?)

	* Menú de estructura fija pero adaptable para cada cliente, es decir, cada cliente podria agregar dashboards especificos y parametros especificos.
	* Debe tener perfiles de visibilidad especificos (puede haber dashboards visibles para un rol que para otros no)

	* Origenes de datos diversos (modelos de datos del Datawerehause) con posibilidad de activacion o no por cada cliente.
		El desafio a nivel BD es
			a) 1 BD multitenant (el desafio podria ser el tamaño de la BD, todos los modelos de datos de todos los clientes) 
			b) 1 BD por tenant (con todos los modelos) 
			c) multiples DB multitenant (una para cada modelo de datos)
			d) multiples DB por cada tenenat (creo que esto seria inmanejable)
		a primera vista me inclino por la opcion b)
		
		
	* Integracion de datos
		El proceso debe ser tipo un workflow (recoleccion, limpieza, update), donde se podria automatizar todo aplicacndo reglas para cada etapa.
		 Esto deberia ser parametrizable por cada integracion por cada cliente.
		Las particularidades debe poder setearse como reglas en diferentes pasos del workflow	
			Ejemplo para un cliente podria descartarse algunos empleados, tipos de licencias, etc.
			
			
		Deberiamos tener modelos de integracion estandar que se puedan activar o no por cada cliente y ademas se puedan adaptar las reglas para el workflow	
			Ej Manú, Geovictoria, Kaivia, RHPro, por files (Excel, txt, json) tal que le integracion consista en leer files desde un directorio y levanar la info. 
		Pero tambien deberiamos poder crear integraciones especificas para cada cliente. Solo las verá el cliente y tambien podria tener que establecer sus reglas.
			Ej. Api de un software a medida de un cliente 
		
		Esto implica una suerte de "Armado de Menú"
	
	
Funcionalidades por vista (cliente o Console (interno)
------------------------------------------------------

Cliente
	Dahsboards
		Multiples dashboards con 
			niveles de granularidad
			Insigths
				Significado de las metricas, recomendaciones, hallazgos
				Preguntas / respuestas (AI driven)
				reportes con exportacion a PDF
				
	Reportes
		Que tipo de reportes podrian ser necesarios mas allá de los dashboards?
		
	Integraciones
		Integraciones activas con 
			estado y ultimo update
			detalle de ejecuciones
			
	Settings
		integraciones
			Activar o desactivar integraciones
			Asistente para integraciones simples? o todas se manajan desde Console??
		Usuarios y Roles

Console
	Administracion
		Clientes
		Roles
		Partners
		Niveles de suscripcion	
		Contratos
		Calculos de Facturacion
		etc
	
	Menú
		Administracion de los menú de cada tenant
			Activacion (on/off)
			
	Modelos de datos
		Setup para cada tenant de los modelos de informacion (People, time, payroll, CRM, ventas, finanzas, etc)
		
	Integraciones
		Modelos
			Integraciones basicas por tipo
				por archivos
					XLS
					txt
					Json
				Api	
					Mandú
					Geovictoria
					Kaivia
					etc
		Activacion (on/off) + particularidades



		
	
Definiciones necesarias por cada proyecto (aplicacion cliente y aplicacion console)
---------------------------------------------------------------------------

Arquitectura
	Proyecto(repositorio)
		Monolitico por modulo
			People Analytics
			Ventas
			CRM
			etc
		Monolitico por cliente
			Seria mas facil de manejar pero un caos de mantenimeinto si crece
			
			
	Seguridad
		Usuarios
		Roles
		Permisos
		autenticacion
		Auditoria
		RLS

	Stack tecnologico
		Frontend
		Backend	
		DB
	
	CI/CD
		Hosting y deploy
		
		
Skills	
	UX/UI/L&F
		dependiendo del tipo de proyecto esto puede variar significativamente
		Patrones de diseño. que estás usando y por qué
	CRUDs. Definicion de template
	API (server actions / rest api)
	Auditoria
	Agent driven
	DB - Documentacion del esquema (diccionario de datos)
	
	Convenciones de nombres y estructura de carpetas
	Manejo de errores estándar para tu stack (toast)
	Librerías aprobadas y prohibidas
	Documentacion de funcionalidades y desiciones de arquitectura, BD, etc
	security review obligatorio
		Queries SQL (riesgo de inyección)
		HTML rendering (riesgo XSS)
		Autenticación y autorización
		Manejo de secrets (nunca hardcodear)
		Validación de inputs	
	
Proyecto
	Roadmap
	Seguimiento
	parking lot
		Mejoras
		Iniciativas

Funcionalidades segun aplicacion (Cliente/Console) 
	Layout de la aplicacion
	Menú

--------------------------
Potencial primero cliente
	Tengo un cliente potencial al cual quiero ofrecerle la solucion en cuanto tenga el MVP
	Para este cliente en particular seria una especi de People Analytics donde quiero darle dahsboards tipo cubo de informacion que consolide informacion de personas, payroll y gestion de tiempo y asistencia, mas especificacamente ausentismos.
	El cliente ya usa soluciones especificas para estos modulos pero ninguna de las soluciones tiene un modulo de analytics y tiene toda la informacion descentralizada.	

	Esto lo aclaro por lo que como parte de la definicion del MVP seria idea centralizarnos en modelo de datos de tipo. 

	
--------------------------
Objetivo inicial: Quiero que me ayudes a darle forma a este proyecto. 
		La definicion de alcance y fases del proyecto.
		Nombre del proyecto (tengo algunas ideas)
			- WinLabs Analytics: esto es porque mi empresa de desarrollo se llama WinLabs y quiero ofrecerla como herramienta propia.
				otros nombres potenciales: WL Analytics
			- Kaivia Analytics: Esto es porque estoy desarrollando una Aplicacion Saas para RRHH que se llama Kaivia (ya tengo la aplicacion Console y aplicacion de HR) en fase de construccion
				otros nombres potenciales: K-Analytics
			- Otro nombre mas "marketinero"
		idea de negocio, esto es el servicio y la monetizacion
		Desiciones de arquitectura y diseño
		Roadmap general (Console y Aplicacion cliente)
		Creacion de proyecto
		Setup inicial
			Contexto
			Roadmap MVP, Post - MVP
		etc	
