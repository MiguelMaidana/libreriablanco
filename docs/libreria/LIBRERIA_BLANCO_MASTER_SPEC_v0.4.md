# Librería Blanco — Especificación Maestra de Producto y Arquitectura

> **Versión:** 0.4  
> **Estado:** Documento consolidado para MVP simple, comercial, sin capacitación y con cierre operativo por WhatsApp  
> **Objetivo:** Servir como contexto maestro para una IA de desarrollo, diseño o arquitectura, de forma que comprenda qué producto debe construir, qué decisiones ya fueron tomadas y qué cosas no debe asumir o modificar sin validación.

---

# 1. Contexto del proyecto

Se necesita construir una **plataforma integral de gestión y e-commerce para Librería Blanco**.

No se trata de una landing page.

El producto debe resolver dos necesidades dentro de **una misma aplicación web**:

1. Un **portal público / e-commerce** orientado a clientes.
2. Un **portal administrativo / backoffice** orientado a los responsables de la librería.

Ambos módulos deben compartir:

- La misma aplicación.
- La misma base de datos.
- La misma lógica de negocio.
- El mismo proyecto de Vercel.
- La misma instancia de Supabase.
- Los mismos modelos y tipos.
- Las mismas integraciones externas.

La intención es mantener el sistema **simple de operar, económico y fácil de mantener**, evitando microservicios, múltiples aplicaciones o infraestructura innecesaria en esta etapa.

---

# 2. Principios no negociables

Estas decisiones ya están tomadas y deben respetarse.

## 2.1 Una sola aplicación

El sistema será una **única aplicación Next.js full-stack**.

No crear:

- Una aplicación separada para el e-commerce.
- Una aplicación separada para el administrador.
- Un backend independiente sin necesidad.
- Microservicios.
- Infraestructura adicional que no aporte valor real al MVP.

Ejemplo conceptual:

```text
https://libreria.com/
https://libreria.com/productos
https://libreria.com/carrito
https://libreria.com/checkout

https://libreria.com/admin
https://libreria.com/admin/productos
https://libreria.com/admin/pedidos
https://libreria.com/admin/clientes
```

---

## 2.2 Stack tecnológico

Stack principal:

- **Next.js**
- **TypeScript**
- **React**
- **Vercel**
- **Supabase**
  - PostgreSQL
  - Auth
  - Storage
- **WhatsApp** mediante enlaces directos / deep links
- Integración futura con **Mercado Pago Checkout Pro**
- Integración futura con **ARCA** para facturación electrónica

El proyecto debe diseñarse para utilizar, en la medida de lo posible, servicios y herramientas con **planes gratuitos**.

## Decisión de pago del MVP

La primera versión utilizará:

```text
TRANSFERENCIA
+
COMPROBANTE POR WHATSAPP
```

No habrá una integración automática de pagos en el MVP.

Mercado Pago Checkout Pro queda explícitamente documentado como **evolutivo**.

## Decisión de hosting

Se mantiene **Vercel** como plataforma de despliegue en esta etapa.

Si más adelante aparece una limitación económica, comercial o técnica real, se evaluará una alternativa. No modificar esta decisión ahora.

---

# 3. Estructura general de la solución

La arquitectura esperada para el MVP es:

```text
                       INTERNET
                           │
                           ▼
                 ┌─────────────────┐
                 │     VERCEL      │
                 │                 │
                 │    NEXT.JS      │
                 │   FULL-STACK    │
                 └────────┬────────┘
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
      PORTAL PÚBLICO              PORTAL ADMIN
             │                         │
             │                    autenticado
             │                         │
             └────────────┬────────────┘
                          │
                          ▼
                    ┌──────────┐
                    │ SUPABASE │
                    ├──────────┤
                    │ Postgres │
                    │ Auth     │
                    │ Storage  │
                    └────┬─────┘
                         │
                         ▼
                    WHATSAPP
              cierre operativo manual
```

En el MVP:

- Supabase es la fuente de datos.
- WhatsApp se utiliza para enviar el comprobante y coordinar el retiro.
- No existe integración automática con una pasarela de pago.
- No existe seguimiento logístico.
- Mercado Pago y ARCA quedan como evolutivos.

---

# 4. Organización sugerida del proyecto

Se prefiere una sola aplicación Next.js.

Estructura conceptual:

```text
libreria-blanco/
│
├── app/
│   │
│   ├── (store)/
│   │   ├── page.tsx
│   │   ├── productos/
│   │   ├── producto/
│   │   ├── categorias/
│   │   ├── carrito/
│   │   ├── checkout/
│   │   ├── compra-exitosa/
│   │   └── pedido/
│   │
│   ├── admin/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── productos/
│   │   ├── categorias/
│   │   ├── stock/
│   │   ├── pedidos/
│   │   ├── clientes/
│   │   ├── proveedores/
│   │   ├── compras/
│   │   ├── precios/
│   │   ├── promociones/
│   │   ├── facturacion/
│   │   ├── usuarios/
│   │   └── configuracion/
│   │
│   └── api/
│       ├── checkout/
│       ├── orders/
│       └── ...

# Evolutivos futuros:
# mercado-pago/
# webhooks/
# arca/
│
├── components/
│   ├── store/
│   ├── admin/
│   └── shared/
│
├── lib/
│   ├── supabase/
│   ├── mercado-pago/
│   ├── arca/
│   ├── auth/
│   └── validations/
│
├── services/
├── types/
├── utils/
└── ...
```

Esta estructura es orientativa.

La IA puede mejorar la organización técnica siempre que mantenga el principio de **una sola aplicación desplegable**.

---

# 5. Portal público / E-commerce

El portal público será accesible por cualquier persona.

## Regla fundamental

**NO se requiere login para navegar ni para comprar.**

El usuario podrá:

- Entrar al sitio.
- Navegar.
- Buscar productos.
- Consultar categorías.
- Ver productos.
- Agregar productos al carrito.
- Modificar el carrito.
- Iniciar checkout.
- Completar sus datos.
- Elegir entrega.
- Pagar.
- Finalizar la compra.

Sin crear una cuenta.

---

# 6. Cliente no es lo mismo que usuario

Esta separación es muy importante.

Una persona puede ser un **cliente de la librería** sin poseer una cuenta autenticada.

Conceptualmente:

```text
CUSTOMER
≠
AUTH USER
```

Un cliente deberá poder existir en la base de datos aunque nunca haya creado una contraseña ni iniciado sesión.

Ejemplo:

```text
Cliente realiza compra
        │
        ▼
Completa datos en checkout
        │
        ▼
Se crea / actualiza customer
        │
        ▼
Se crea order
        │
        ▼
Se procesa pago
```

No se debe obligar a crear una cuenta.

---

# 7. Checkout como invitado

El flujo principal del e-commerce será un **Guest Checkout**.

Durante el checkout se deberán solicitar únicamente los datos necesarios para completar correctamente la compra.

### Datos personales

- Nombre.
- Apellido.
- Email.
- Teléfono.

### Datos fiscales

Cuando correspondan:

- Tipo de documento.
- DNI / CUIT.
- Condición fiscal.
- Razón social, si corresponde.

## Modalidad de entrega del MVP

En esta primera versión existe una única modalidad formal de entrega dentro del sistema:

```text
RETIRO EN EL LOCAL
```

Por lo tanto, el checkout **no deberá solicitar dirección de envío**.

El usuario deberá visualizar claramente:

- Dirección del local.
- Horarios de retiro.
- Información necesaria para retirar.
- Mensaje indicando cuándo puede acercarse.

## ¿Necesitás envío?

Los envíos no se gestionarán dentro de la plataforma en el MVP.

Si una persona necesita envío deberá poder contactarse directamente con la librería mediante WhatsApp.

En el checkout y/o carrito deberá mostrarse una acción clara:

```text
¿Necesitás envío?
Consultanos por WhatsApp
```

Esta acción deberá abrir WhatsApp con un mensaje precompletado para reducir fricción.

Ejemplo conceptual:

```text
Hola, quisiera consultar si pueden enviar mi compra.
```

Idealmente el mensaje podrá incorporar automáticamente contexto útil como nombres de productos o número de pedido, sin incluir información sensible.

El envío será coordinado manualmente por la librería fuera del flujo automático del MVP.

---

# 8. Persistencia del cliente

Aunque el cliente no se autentique, sus datos deberán almacenarse correctamente en la base.

Tabla conceptual:

```text
customers

id
first_name
last_name
email
phone
document_type
document_number
tax_condition
auth_user_id nullable
created_at
updated_at
```

`auth_user_id` debe ser opcional.

Ejemplo:

```text
customer.auth_user_id = NULL
```

es totalmente válido.

Esto representa un cliente que compró como invitado.

---

# 9. Cuenta de cliente — funcionalidad futura

No es necesaria para el MVP.

En una evolución posterior se podrá permitir que el cliente cree o vincule una cuenta.

La preferencia será utilizar autenticación con poca fricción:

- Google.
- Magic Link.
- OTP / código por email.

Evitar inicialmente:

```text
email + password
```

para clientes.

El objetivo es no incorporar innecesariamente:

- Recuperación de contraseña.
- Cambio de contraseña.
- Políticas de contraseña.
- Soporte por credenciales olvidadas.

En el futuro, si un cliente crea una cuenta, deberá ser posible vincular el usuario autenticado con su registro histórico de `customer`.

De esta manera podrá consultar compras realizadas previamente como invitado.

---

# 10. Administración

El backoffice será accesible bajo:

```text
/admin
```

Ejemplo:

```text
libreria.com/admin
```

A diferencia del portal público, **el backoffice sí requiere autenticación obligatoria**.

La autenticación administrativa será gestionada con Supabase Auth.

## Requisito crítico: cero capacitación

Las personas que utilizarán diariamente el administrador **no son usuarias técnicas y no existirá una etapa formal de aprendizaje o capacitación del sistema**.

Por lo tanto, el administrador debe poder aprenderse prácticamente por uso.

Esto es un requisito funcional y de UX, no una preferencia estética.

El sistema deberá priorizar:

- Lenguaje cotidiano.
- Botones con acciones explícitas.
- Formularios cortos y guiados.
- Valores predeterminados razonables.
- Ayudas contextuales breves.
- Mensajes de éxito claros.
- Errores explicados en lenguaje simple.
- Pocas opciones visibles por pantalla.
- Navegación consistente.
- Búsqueda rápida.
- Acciones frecuentes siempre visibles.
- Confirmaciones solamente para acciones sensibles.

Evitar terminología técnica en la interfaz.

Ejemplos:

```text
"Agregar producto"
en lugar de
"Crear entidad"
```

```text
"Disponible para vender"
en lugar de
"is_active"
```

```text
"Guardar cambios"
en lugar de
"Update"
```

## Regla de simplicidad

Si una operación habitual necesita una explicación externa para poder realizarse, el diseño debe considerarse mejorable.

Una persona que ingrese por primera vez debería poder comprender intuitivamente cómo:

1. Agregar un producto.
2. Cambiar un precio.
3. Agregar stock.
4. Ver una venta.
5. Buscar un cliente.
6. Ver los pedidos nuevos.
7. Marcar un pedido como listo para retirar.

La prioridad es que el administrador sea una herramienta cotidiana simple, no un ERP complejo.

---

# 11. Roles administrativos

El sistema deberá implementar **roles y permisos configurables**.

## Superadministrador

Debe existir un rol especial:

```text
SUPER_ADMIN
```

El `SUPER_ADMIN` podrá:

- Crear roles.
- Editar roles.
- Deshabilitar roles.
- Crear usuarios administrativos.
- Deshabilitar usuarios administrativos.
- Asignar uno o más roles a usuarios según el modelo definido.
- Configurar permisos de cada rol.
- Consultar y modificar la configuración completa del sistema.

El sistema deberá impedir eliminar o dejar sin acceso al último `SUPER_ADMIN`.

## Roles dinámicos

Los roles del negocio no deben quedar limitados a una lista fija en código.

El superadministrador podrá crear, por ejemplo:

```text
Administradora
Vendedora
Stock
Caja
Solo lectura
```

## Permisos

La interfaz de permisos deberá ser visual y simple.

Ejemplo conceptual:

| Módulo | Ver | Crear | Editar | Eliminar / Anular |
|---|---:|---:|---:|---:|
| Productos | ✓ | ✓ | ✓ | ✓ |
| Precios | ✓ |  | ✓ |  |
| Stock | ✓ | ✓ | ✓ |  |
| Pedidos | ✓ |  | ✓ | ✓ |
| Clientes | ✓ |  | ✓ |  |
| Facturación | ✓ | ✓ | ✓ | ✓ |
| Usuarios | ✓ | ✓ | ✓ | ✓ |
| Configuración | ✓ |  | ✓ |  |

La UI deberá utilizar checkboxes, toggles o una matriz entendible.

No pedir a la administradora que escriba identificadores técnicos de permisos.

## Solo lectura

Debe ser posible crear roles que únicamente puedan consultar determinada información.

Ejemplo:

```text
ROL: Solo lectura

Productos      → Ver
Stock          → Ver
Pedidos        → Ver
Clientes       → Ver
Precios        → Ver
Configuración  → Sin acceso
Usuarios       → Sin acceso
```

La autenticación será responsabilidad de Supabase Auth.

Los roles y permisos propios del negocio deberán almacenarse en tablas de la aplicación y validarse **también en servidor**, no solamente ocultando botones en el frontend.

---

# 12. Catálogo de productos

El e-commerce deberá mostrar el catálogo administrado desde el backoffice.

Funcionalidades públicas:

- Grilla de productos.
- Búsqueda.
- Categorías.
- Filtros simples.
- Ordenamiento.
- Productos destacados.
- Productos recomendados.
- Novedades.
- Productos con promoción.
- Productos disponibles.
- Detalle de producto.

## El portal debe vender, no solamente mostrar

La página pública no debe ser simplemente una base de productos con carrito.

Debe tener una **mirada comercial** y ayudar a dirigir la atención hacia los productos que la librería desea impulsar.

La Home deberá poder incorporar bloques como:

```text
NUESTROS FAVORITOS
DESTACADOS
RECOMENDADOS
NOVEDADES
OFERTAS
MÁS BUSCADOS
MÁS VISTOS
MÁS VENDIDOS
CATEGORÍAS DESTACADAS
```

No es obligatorio mostrar todos simultáneamente.

## Curación manual como prioridad

Para el MVP, las administradoras deberán poder seleccionar manualmente productos que quieren promocionar.

La experiencia debería ser tan simple como:

```text
☑ Mostrar en "Nuestros favoritos"
☑ Producto destacado
```

y, opcionalmente:

```text
Prioridad: 1, 2, 3...
```

Esto es más importante en el MVP que construir un algoritmo de recomendación.

## Señales automáticas

El sistema deberá quedar preparado para registrar señales sencillas:

- Visualizaciones de producto.
- Términos buscados.
- Productos agregados al carrito.
- Productos vendidos.

Con esos datos se podrán construir automáticamente secciones como:

```text
Más vistos
Más buscados
Más vendidos
```

En el MVP pueden convivir:

1. Selección comercial manual.
2. Rankings simples calculados a partir de actividad real.

No desarrollar un motor de recomendación complejo.

## Regla comercial de la Home

La Home debe responder rápidamente:

1. ¿Qué vende Librería Blanco?
2. ¿Qué productos conviene mirar primero?
3. ¿Qué novedades u ofertas existen?
4. ¿Cómo encuentro rápido lo que necesito?
5. ¿Cómo compro?
6. ¿Cómo consulto por WhatsApp?

La experiencia debe favorecer descubrimiento, compra por impulso y confianza.

---

# 13. Producto

Cada producto deberá poder almacenar, como mínimo:

### Identificación

- ID.
- Código interno.
- SKU.
- Código de barras cuando corresponda.
- ISBN cuando corresponda.

### Información comercial

- Nombre.
- Descripción corta.
- Descripción completa.
- Marca.
- Editorial.
- Autor, cuando aplique.
- Categoría.
- Subcategoría.
- Tags.

### Multimedia

- Imagen principal.
- Imágenes adicionales.

### Precio

- Costo.
- Precio de venta.
- Margen.
- Ganancia.
- Precio promocional, cuando corresponda.

### Stock

- Stock actual.
- Stock mínimo.
- Permitir venta.
- Estado de disponibilidad.

### Publicación

- Publicado / no publicado.
- Destacado.
- Activo / inactivo.

### Auditoría

- Fecha de creación.
- Fecha de modificación.
- Usuario que realizó modificaciones relevantes.

---

# 14. Gestión de productos — Admin

Se necesita CRUD completo:

- Crear.
- Consultar.
- Editar.
- Deshabilitar.
- Reactivar.
- Eliminar solamente cuando sea seguro hacerlo.

Preferir baja lógica / deshabilitación cuando el producto ya tenga historial de ventas.

Debe permitir:

- Cargar imágenes.
- Modificar precios.
- Actualizar stock.
- Asignar categorías.
- Configurar promociones.
- Publicar / despublicar.
- Marcar como destacado.

---

# 15. Categorías

El administrador deberá poder gestionar categorías.

Ejemplos posibles:

- Escolar.
- Oficina.
- Artística.
- Papelería.
- Escritura.
- Cuadernos.
- Carpetas.
- Libros.
- Regalería.
- Otros.

No hardcodear categorías en el código.

Deben administrarse desde la base de datos.

---

# 16. Precios, costos y rentabilidad

Uno de los objetivos principales del backoffice es conocer la rentabilidad real de los productos.

Como mínimo:

```text
Ganancia = Precio de venta - Costo
```

También deberá calcularse:

```text
Margen sobre venta = Ganancia / Precio de venta * 100
```

Cuando sea necesario se podrá mostrar también markup:

```text
Markup = Ganancia / Costo * 100
```

Es importante no confundir ambos indicadores.

El administrador deberá visualizar claramente:

- Costo.
- Precio.
- Ganancia monetaria.
- Margen porcentual.

---

# 17. Historial de precios

Idealmente el sistema deberá estar preparado para mantener historial de:

- Cambios de costo.
- Cambios de precio de venta.
- Usuario que realizó el cambio.
- Fecha.
- Valor anterior.
- Valor nuevo.

Esto será útil para análisis futuro de rentabilidad.

---

# 18. Inventario / Stock

El MVP **no será un sistema de inventario cuantitativo**.

La plataforma no conoce todas las ventas físicas del local y, por lo tanto, no intentará mantener un stock numérico sincronizado.

La regla operativa será:

> **Si un producto está publicado y marcado como disponible, se considera que puede venderse.**

Cada producto tendrá un control simple:

```text
Disponible en la tienda: Sí / No
```

Las administradoras son responsables de mantener esta disponibilidad actualizada.

Cuando un producto deja de estar disponible:

- No podrá agregarse al carrito.
- Puede ocultarse del catálogo o mostrarse como no disponible según la decisión comercial configurada.

## Fuera del MVP

No implementar inicialmente:

- Stock numérico obligatorio.
- Stock reservado.
- Movimientos de inventario.
- Ingresos / egresos.
- Venta física.
- Depósitos.
- Sincronización entre local y e-commerce.
- Alertas de stock mínimo.

---

# 19. Stock mínimo

No forma parte del MVP.

La plataforma no llevará stock mínimo ni alertas cuantitativas.

El criterio de disponibilidad será únicamente:

```text
available = true
```

o:

```text
available = false
```

---

# 20. Carrito

El carrito deberá permitir:

- Agregar producto.
- Eliminar producto.
- Cambiar cantidad.
- Visualizar precio unitario.
- Visualizar subtotal.
- Visualizar total.
- Continuar comprando.
- Ir al checkout.

Antes de crear el pedido, el servidor deberá verificar nuevamente que cada producto continúe:

```text
publicado
+
disponible
```

No se gestionará stock cuantitativo.

Si un producto dejó de estar disponible mientras el cliente estaba comprando, deberá mostrarse un mensaje claro y evitar finalizar ese ítem.

Mensaje visible:

```text
Retiro en el local.
¿Necesitás envío? Consultanos por WhatsApp.
```

---

# 21. Pedidos

Cada compra generará un pedido **antes de abrir WhatsApp**.

Modelo conceptual:

```text
orders

id
order_number
customer_id
status
subtotal
total
payment_method
payment_confirmed_at nullable
created_at
updated_at
```

## Método de pago del MVP

```text
BANK_TRANSFER
```

El pedido no recibe confirmación bancaria automática.

La librería valida manualmente el comprobante enviado por WhatsApp.

El pedido sirve para:

- Identificar la operación.
- Registrar al cliente.
- Registrar productos y precios.
- Generar un número único.
- Generar el mensaje de WhatsApp.
- Consultar la venta desde el Admin.
- Mantener historial comercial.

---

# 22. Items del pedido

Los productos comprados deben persistirse históricamente.

Tabla conceptual:

```text
order_items

id
order_id
product_id
product_name_snapshot
sku_snapshot
unit_cost_snapshot
unit_price
quantity
subtotal
```

Es importante guardar snapshots de datos relevantes.

Si mañana cambia el nombre o precio de un producto, una venta histórica no debe modificarse.

---

# 23. Estados del pedido

Para el MVP se utilizará un flujo deliberadamente simple.

Estados:

```text
NEW
COMPLETED
CANCELLED
```

En la interfaz:

```text
Nuevo
Finalizado
Cancelado
```

Si durante el refinamiento operativo resulta útil, se podrá incorporar:

```text
CONFIRMED
```

para indicar que el comprobante fue validado manualmente.

No implementar inicialmente:

- Estados automáticos de pago.
- Preparación.
- Listo para retirar.
- Retirado.
- Enviado.
- Tracking.
- Timeline público.
- Devoluciones.
- Reembolsos.

La coordinación concreta ocurre por WhatsApp.

---

# 24. Mercado Pago

Mercado Pago **no forma parte del MVP**.

La primera versión utilizará:

```text
Transferencia
+
Comprobante por WhatsApp
```

## Evolutivo

Se deja preparado conceptualmente:

```text
Checkout
   │
   ▼
Mercado Pago Checkout Pro
   │
   ▼
Pago online
   │
   ▼
Confirmación automática
```

Cuando se implemente deberá hacerse del lado servidor para cualquier operación sensible y deberá utilizar webhooks e idempotencia.

No desarrollar esta integración hasta que se decida avanzar con el evolutivo.

---

# 25. Webhooks de Mercado Pago

No forman parte del MVP.

Esta sección queda únicamente como requisito futuro para una eventual integración con Mercado Pago.

Cuando se implemente:

1. Recibir webhook.
2. Validar la notificación.
3. Consultar estado real cuando corresponda.
4. Evitar procesamiento duplicado.
5. Registrar el evento.
6. Actualizar pago.
7. Actualizar pedido.

---

# 26. Pagos

En el MVP no existe una pasarela integrada.

La forma de pago será:

```text
Transferencia bancaria
```

El pedido deberá conservar:

```text
payment_method = BANK_TRANSFER
```

Puede existir un campo administrativo opcional:

```text
payment_confirmed_at
```

para marcar manualmente que el comprobante fue validado.

## Evolutivo

Cuando se integre Mercado Pago se podrá agregar una entidad específica `payments`.

---

# 27. ARCA / Facturación electrónica

ARCA **no forma parte del MVP inicial** y no debe bloquear su salida.

La arquitectura debe permitir incorporarlo posteriormente.

Cuando se implemente deberá contemplar:

- Datos fiscales de la librería.
- Datos fiscales del comprador cuando correspondan.
- Tipo de comprobante.
- Punto de venta.
- Numeración.
- CAE.
- Vencimiento de CAE.
- Asociación con pedido.

No inventar reglas fiscales.

Antes de implementar ARCA se deberá verificar la documentación oficial y la situación fiscal vigente de la librería.

---

# 28. Facturas

No forman parte de la primera salida funcional del MVP.

El modelo deberá permitir agregarlas posteriormente sin modificar de manera destructiva los pedidos existentes.

No mostrar un módulo de Facturación en el Admin hasta que esta funcionalidad esté realmente implementada.

---

# 29. Clientes

Desde el administrador deberá poder consultarse la base de clientes.

Funciones:

- Buscar cliente.
- Consultar datos.
- Ver historial de compras.
- Ver pedidos.
- Ver total comprado.
- Ver última compra.
- Ver facturas relacionadas.
- Editar datos cuando corresponda.

No exponer información innecesaria.

---

# 30. Proveedores

Aunque puede no formar parte de la primera entrega, el modelo debe contemplar gestión de proveedores.

Datos posibles:

- Razón social.
- Nombre comercial.
- CUIT.
- Email.
- Teléfono.
- Dirección.
- Contacto.
- Observaciones.
- Activo.

---

# 31. Compras a proveedores

Una evolución esperada es registrar ingreso de mercadería.

Conceptualmente:

```text
Proveedor
   │
   ▼
Orden / compra
   │
   ▼
Items
   │
   ▼
Ingreso de stock
   │
   ▼
Actualización de costos
```

Esto permitirá conocer mejor:

- Costo real.
- Compras realizadas.
- Deuda / pagos a proveedor, si en el futuro se incorpora.
- Evolución de costos.
- Rentabilidad.

---

# 32. Promociones y descuentos

El sistema deberá quedar preparado para manejar promociones.

Ejemplos futuros:

- Precio promocional.
- Descuento porcentual.
- Descuento fijo.
- Producto destacado.
- Promociones por fechas.
- Cupones.
- Combos.

No es necesario implementar toda la lógica avanzada en el MVP.

---

# 33. Dashboard administrativo

Al ingresar a `/admin` deberá existir un dashboard **extremadamente simple**.

La pregunta principal es:

> **¿Qué necesito hacer ahora?**

Prioridad visual:

- Pedidos nuevos.
- Productos publicados.
- Productos no disponibles.
- Ventas registradas del día.
- Botón rápido `Agregar producto`.

Información secundaria:

- Ventas de la semana.
- Ventas del mes.
- Productos más vendidos.
- Productos más vistos.
- Ganancia estimada.

Evitar:

- Gráficos decorativos.
- KPIs complejos.
- Stock cuantitativo.
- Exceso de información.

El dashboard debe ser operativo antes que analítico.

---

# 34. Configuración general

Debe existir un módulo administrativo de configuración.

## Negocio

- Nombre comercial.
- Razón social.
- CUIT.
- Logo.
- Dirección.
- Teléfono.
- WhatsApp.
- Email.
- Redes sociales.
- Horarios.

## Transferencia

Configurable sin tocar código:

- Alias.
- CBU/CVU cuando corresponda.
- Titular.
- Banco o billetera, si se desea mostrar.
- Texto de instrucciones.

## WhatsApp

- Número oficial.
- Mensaje general.
- Plantilla de mensaje para comprobante.
- Plantilla de mensaje para consulta de envío.

## Tienda

- Compra habilitada.
- Mensajes informativos.
- Texto de retiro en local.
- Hero.
- Categorías destacadas.

## Evolutivos

Pueden documentarse como futuros:

```text
Mercado Pago
ARCA
```

No mostrar campos técnicos ni secretos mientras esas integraciones no existan.

---

# 35. Diseño visual

## Referencia principal

Existe una primera prueba creada previamente en Lovable:

```text
https://blanco-shelf.lovable.app/
```

Esta implementación **NO define la arquitectura ni las funcionalidades finales**.

Debe utilizarse únicamente como:

- Referencia estética.
- Referencia de personalidad visual.
- Punto de partida de branding.
- Inspiración para el portal público.

Cuando la IA tenga acceso mediante navegador deberá:

1. Inspeccionar la referencia.
2. Identificar:
   - Paleta.
   - Tipografía.
   - Espaciados.
   - Bordes.
   - Radios.
   - Cards.
   - Header.
   - Hero.
   - Botones.
   - Estilo de imágenes.
   - Iconografía.
3. Reutilizar el lenguaje visual que tenga sentido.
4. Mejorar inconsistencias.
5. No copiar malas decisiones UX simplemente porque existen en la prueba.

---

# 36. Dirección visual de respaldo

Si la referencia de Lovable no pudiera inspeccionarse, utilizar la siguiente dirección de diseño:

**Concepto:**

> Librería de barrio moderna, cálida, cercana, ordenada y confiable.

Debe sentirse:

- Familiar.
- Amigable.
- Moderna.
- Simple.
- Colorida sin resultar infantil.
- Comercial sin parecer un marketplace genérico.
- Relacionada con papelería, útiles, creatividad y educación.

Evitar:

- Look corporativo frío.
- Exceso de gradientes.
- Efectos futuristas.
- Glassmorphism innecesario.
- Exceso de sombras.
- Animaciones que dificulten comprar.
- Interfaz saturada.
- Estética genérica de dashboard SaaS para el e-commerce.

El producto debe ser el protagonista.

---

# 37. Responsive

Toda la plataforma debe ser **100% responsive**.

Este requisito aplica tanto al e-commerce como al administrador.

## Portal público

Diseño **mobile-first**, considerando que una parte importante de los compradores llegará desde celular o WhatsApp.

Debe funcionar correctamente en:

- Smartphone.
- Tablet.
- Notebook.
- Desktop.

Especial atención a:

- Navegación táctil.
- Buscador.
- Cards de producto.
- Selectores de cantidad.
- Carrito.
- Checkout.
- Botón de WhatsApp.
- Botones de compra.

## Administrador

Aunque su uso principal pueda ser desktop o tablet, también debe adaptarse correctamente a celular.

En pantallas pequeñas:

- Sidebar colapsable.
- Tablas convertidas en vistas más legibles cuando corresponda.
- Acciones principales accesibles.
- Formularios en una sola columna.
- Botones con tamaño táctil correcto.

## Buenas prácticas obligatorias de UI/UX

La IA deberá aplicar buenas prácticas modernas de diseño de interfaces y experiencia de usuario:

- Jerarquía visual clara.
- Consistencia entre pantallas.
- Espaciado coherente.
- Tipografía legible.
- Contraste suficiente.
- Targets táctiles apropiados.
- Estados hover, focus, active, disabled y loading.
- Skeletons o feedback cuando corresponda.
- Empty states útiles.
- Errores inline comprensibles.
- Confirmación visual de acciones exitosas.
- Prevención de errores antes que mensajes posteriores.
- Diseño accesible.
- Formularios con labels reales.
- Navegación por teclado.
- Focus visible.
- Semántica HTML correcta.
- Componentes reutilizables.
- No depender solamente del color para comunicar estados.

## Principio

La interfaz debe verse profesional, pero la facilidad de uso tiene prioridad sobre efectos visuales o tendencias de diseño.

```text
CLARIDAD > DECORACIÓN
USABILIDAD > COMPLEJIDAD
VELOCIDAD > ANIMACIONES
```

---

# 38. Diseño del Admin

El administrador tendrá una identidad coherente con Librería Blanco, pero su principal objetivo será facilitar el trabajo cotidiano.

Estructura sugerida:

```text
Sidebar simple
Header
Contenido
Búsqueda
Acción principal
Tablas sencillas
Formularios guiados
```

## Menú sugerido para el MVP

```text
Inicio
Productos
Stock
Pedidos
Clientes
Facturación
Usuarios
Configuración
```

No mostrar en primer nivel funcionalidades que todavía no estén disponibles.

## Reglas UX

- Una acción primaria clara por pantalla.
- Texto grande y legible.
- Íconos acompañados por texto cuando puedan generar dudas.
- Formularios divididos en bloques entendibles.
- Ocultar opciones avanzadas hasta que hagan falta.
- Usar búsqueda antes que decenas de filtros.
- Mantener Guardar / Cancelar en posiciones consistentes.
- Confirmar acciones destructivas.
- Explicar claramente el resultado de cada acción.
- Evitar menús profundos.
- No hacer que una operación frecuente requiera muchas pantallas.

## Ejemplo: cargar un producto

Idealmente:

```text
Agregar producto
      ↓
Nombre
Categoría
Precio de costo
Precio de venta
Stock
Foto
      ↓
Guardar y publicar
```

Los campos avanzados pueden estar disponibles, pero no deben bloquear la carga rápida de un producto simple.

---

# 39. Supabase

Supabase será la plataforma principal de persistencia, autenticación y archivos.

## Validación del plan Free

La arquitectura del MVP se diseñará para funcionar con el **plan Free de Supabase**.

Según la información oficial vigente consultada en agosto de 2026, el plan Free incluye:

### PostgreSQL

- Base de datos PostgreSQL.
- **500 MB** de tamaño de base de datos por proyecto.
- Requests de API ilimitados dentro del esquema del plan.
- Instancia Nano con recursos compartidos.

Cuando la base supera el límite permitido del plan Free puede entrar en modo de solo lectura, por lo que deberá monitorearse el crecimiento.

### Auth

Incluido en Free:

- **50.000 usuarios activos mensuales (MAU)**.
- Usuarios totales ilimitados.
- Social OAuth.
- Anonymous Sign-ins.
- Basic MFA.
- Custom SMTP.

Para este proyecto se utilizará Auth principalmente para usuarios administrativos, por lo que esta cuota debería ser ampliamente suficiente durante el MVP.

### Storage

Incluido en Free:

- **1 GB de almacenamiento de archivos**.
- Basic CDN.
- Controles de acceso personalizados.
- Tamaño máximo de archivo de 50 MB.
- 5 GB de cached egress incluido en el plan.

Storage se utilizará principalmente para:

- Fotos de productos.
- Logo.
- Imágenes administrables.

## Restricciones importantes del Free Plan

La IA y el administrador del proyecto deben conocer estas limitaciones:

- Los proyectos Free pueden pausarse después de aproximadamente **7 días de baja actividad/inactividad**.
- El plan Free **no incluye backups automáticos**.
- No incluye Point-in-Time Recovery.
- Existe un límite de proyectos Free activos según las condiciones vigentes del servicio.

Esto no invalida el uso de Supabase Free para el MVP, pero debe quedar documentado.

## Estrategia para imágenes

Como Storage Free dispone de 1 GB, se deberán optimizar las imágenes antes de almacenarlas.

Buenas prácticas:

- WebP o AVIF cuando corresponda.
- Resoluciones razonables.
- No guardar fotografías originales gigantes.
- Limitar cantidad de imágenes por producto en el MVP.
- Evitar duplicados.
- Política de eliminación para assets huérfanos.

## Uso

### PostgreSQL

Para:

- Productos.
- Categorías.
- Clientes.
- Pedidos.
- Items.
- Stock.
- Pagos.
- Facturas.
- Configuraciones.
- Usuarios administrativos.
- Roles.
- Permisos.

### Auth

Principalmente para:

- Administradores.

Potencialmente en una versión posterior:

- Clientes autenticados.

### Storage

Para:

- Imágenes de productos.
- Logo.
- Assets administrables.

---

# 40. Seguridad

La seguridad deberá estar presente desde el diseño.

Principios:

- No confiar en el frontend.
- No exponer claves privadas.
- Validar inputs en servidor.
- Aplicar autorización administrativa.
- Implementar Row Level Security donde corresponda.
- Utilizar variables de entorno.
- Validar webhooks.
- Implementar idempotencia.
- Sanitizar datos.
- Proteger rutas administrativas.
- Evitar acceso directo indebido a información de clientes.
- No almacenar datos sensibles de tarjetas.

---

# 41. Row Level Security

Supabase deberá configurarse utilizando políticas RLS apropiadas.

La existencia de una API pública no significa que las tablas deban quedar abiertas.

La IA deberá documentar claramente:

- Qué tablas pueden consultarse públicamente.
- Qué columnas son públicas.
- Qué operaciones son exclusivas de administradores.
- Qué operaciones se realizan únicamente desde servidor.

Ejemplo:

Los clientes públicos pueden necesitar leer:

```text
productos publicados
categorías activas
precios públicos
stock disponible o indicador de disponibilidad
```

Pero nunca deberían poder modificar directamente:

```text
productos
precios
stock
pedidos de terceros
clientes
configuración
usuarios
```

---

# 42. Server-side

Las operaciones críticas deben ejecutarse en servidor.

Ejemplos:

- Crear pedido definitivo.
- Validar precio real.
- Validar stock.
- Calcular totales.
- Crear pago.
- Procesar webhook.
- Actualizar stock.
- Generar factura.
- Aplicar promociones.
- Modificar configuraciones administrativas.

No aceptar totales calculados por el navegador como fuente de verdad.

---

# 43. Manejo del stock durante una compra

El MVP no administra stock cuantitativo ni reservas.

Antes de crear un pedido, el servidor solamente debe validar que cada producto:

```text
is_published = true
available = true
```

Si un producto dejó de estar disponible, deberá excluirse de la compra y explicarse claramente al cliente.

Se acepta conscientemente que la disponibilidad depende de que las administradoras mantengan actualizado el catálogo.

---

# 44. SEO

El portal público debe ser indexable.

Se deberá contemplar:

- Metadata.
- Titles.
- Descriptions.
- URLs amigables.
- Slugs.
- Sitemap.
- Robots.
- Open Graph.
- Structured data cuando corresponda.
- Renderizado adecuado para productos.

Ejemplo:

```text
/productos/cuaderno-rivadavia-a4
```

preferible a:

```text
/product?id=927
```

---

# 45. Performance

Priorizar:

- Server Components cuando aporten valor.
- Optimización de imágenes.
- Lazy loading.
- Caché apropiada.
- Consultas eficientes.
- Paginación.
- Evitar traer catálogos completos innecesariamente.
- Evitar dependencias frontend gigantes.

El sitio debe sentirse rápido particularmente en dispositivos móviles.

---

# 46. Accesibilidad

Contemplar como mínimo:

- HTML semántico.
- Labels.
- Contraste.
- Navegación por teclado.
- Estados de foco.
- Alt text.
- Mensajes de error entendibles.
- Botones con targets adecuados en mobile.

---

# 47. Manejo de errores

El usuario nunca debería encontrar errores técnicos crudos.

Ejemplos:

En vez de:

```text
SQL ERROR 23505
```

mostrar:

```text
No pudimos completar la operación. Intentá nuevamente.
```

Internamente sí deberá existir logging técnico suficiente para diagnóstico.

---

# 48. Auditoría administrativa

Para operaciones relevantes conviene mantener trazabilidad.

Ejemplos:

- Cambio de precio.
- Ajuste de stock.
- Cancelación de pedido.
- Cambio de configuración.
- Gestión de usuarios.
- Facturación manual.

Modelo futuro:

```text
audit_logs

id
admin_user_id
action
entity_type
entity_id
before
after
created_at
```

---

# 49. Entidades iniciales del dominio

Para el MVP:

```text
customers

admin_profiles
roles
permissions
role_permissions

products
product_images
categories

orders
order_items

settings

product_events
audit_logs
```

Entidades futuras:

```text
payments
invoices
suppliers
purchases
purchase_items
promotions
addresses
inventory_movements
```

No crear tablas futuras hasta que exista una necesidad real.

---

# 50. Relaciones conceptuales principales

MVP:

```text
CUSTOMER
   │
   └───────────< ORDERS
                    │
                    └────< ORDER_ITEMS >──── PRODUCTS


PRODUCTS
   │
   ├──── CATEGORY
   └──── PRODUCT_IMAGES


ADMIN_PROFILE
   │
   └──── ROLE
          │
          └──── ROLE_PERMISSIONS
                    │
                    └──── PERMISSIONS
```

Evolutivos:

```text
ORDERS
   ├──── PAYMENTS
   └──── INVOICES
```

---

# 51. Primera aproximación de rutas públicas

```text
/
```
Home comercial.

```text
/productos
```
Catálogo.

```text
/productos/[slug]
```
Detalle.

```text
/categoria/[slug]
```
Categoría.

```text
/carrito
```
Carrito.

```text
/checkout
```
Checkout invitado.

```text
/compra-exitosa
```
Confirmación + datos de transferencia + acceso a WhatsApp.

No existirá seguimiento público de pedidos en el MVP.

---

# 52. Primera aproximación de rutas administrativas

```text
/admin/login

/admin

/admin/productos
/admin/productos/nuevo
/admin/productos/[id]

/admin/categorias

/admin/pedidos
/admin/pedidos/[id]

/admin/clientes
/admin/clientes/[id]

/admin/usuarios
/admin/roles

/admin/configuracion
```

No mostrar inicialmente módulos de:

- Stock.
- Facturación.
- Proveedores.
- Compras.
- Promociones avanzadas.

---

# 53. Experiencia de compra esperada

La compra debe tener la menor fricción posible.

```text
HOME
 ↓
CATÁLOGO
 ↓
PRODUCTO
 ↓
CARRITO
 ↓
CHECKOUT
 ↓
DATOS CLIENTE
 ↓
CONFIRMAR PEDIDO
 ↓
DATOS DE TRANSFERENCIA
 ↓
CLIENTE TRANSFIERE
 ↓
ENVIAR COMPROBANTE POR WHATSAPP
 ↓
COORDINAR RETIRO
```

No agregar login.

No pedir contraseña.

No integrar pagos online en el MVP.

El pedido debe existir antes de abrir WhatsApp, para enviar:

- Número de pedido.
- Total.
- Texto precompletado.

---

# 54. Experiencia administrativa esperada

Flujo de producto:

```text
ADMIN
 ↓
PRODUCTOS
 ↓
NUEVO PRODUCTO
 ↓
NOMBRE
 ↓
CATEGORÍA
 ↓
COSTO
 ↓
PRECIO
 ↓
FOTO
 ↓
DISPONIBLE: SÍ / NO
 ↓
DESTACAR: SÍ / NO
 ↓
PUBLICAR
```

Flujo de pedido:

```text
ADMIN
 ↓
PEDIDOS
 ↓
PEDIDO NUEVO
 ↓
VER CLIENTE
 ↓
VER PRODUCTOS
 ↓
VER TOTAL
 ↓
WHATSAPP SI ES NECESARIO
 ↓
FINALIZAR
```

La validación del comprobante, horario y retiro se resuelven manualmente.

---

# 55. MVP propuesto

El MVP deberá ser deliberadamente simple.

## Incluye

1. Catálogo.
2. Categorías.
3. Costos.
4. Precios.
5. Publicación / despublicación.
6. Disponible / no disponible.
7. Destacados comerciales.
8. Novedades.
9. Búsqueda.
10. Compra sin login.
11. Clientes.
12. Pedidos.
13. Número único de pedido.
14. Datos de transferencia.
15. WhatsApp con mensaje precompletado.
16. Envío manual del comprobante.
17. Coordinación de retiro por WhatsApp.
18. Gestión simple de pedidos.
19. Usuarios administrativos.
20. Roles dinámicos.
21. Permisos.
22. Dashboard básico.
23. Supabase Auth para Admin.
24. Responsive.
25. Buenas prácticas UI/UX.

## Fuera del MVP

- Stock cuantitativo.
- Inventario.
- Cuenta de cliente.
- Tracking.
- Envíos automáticos.
- Mercado Pago integrado.
- Webhooks de pagos.
- ARCA.
- Facturación electrónica.
- Devoluciones.
- Reembolsos.
- POS.
- Proveedores.
- Compras.
- Múltiples sucursales.
- Recomendaciones complejas.

---

# 56. Fase posterior

## Pagos

- Mercado Pago Checkout Pro.
- Confirmación automática.
- Webhooks.

## Facturación

- ARCA.
- Facturación electrónica.

## Cliente

- Cuenta opcional.
- Google Login.
- Magic Link.
- Historial.
- Seguimiento.

## Operación

- Stock cuantitativo.
- Inventario.
- POS.
- Proveedores.
- Compras.
- Múltiples sucursales.

## Comercial

- Cupones.
- Promociones avanzadas.
- Combos.
- Listas escolares.
- Recomendaciones avanzadas.

## Administración

- Importaciones.
- Exportaciones.
- Reportes avanzados.

---

# 57. Punto de venta físico — no asumir

La librería posee operación física, pero el alcance inicial del POS / caja presencial aún debe definirse.

No implementar un POS completo sin validación.

Sin embargo, el modelo de datos no debería bloquear esta evolución.

Futuro posible:

```text
VENTA ONLINE
        │
        ├──── INVENTARIO ÚNICO
        │
VENTA LOCAL
```

---

# 58. Envíos

La única modalidad formal del MVP es:

```text
RETIRO EN EL LOCAL
```

Si el cliente necesita envío:

```text
¿Necesitás envío?
Consultanos por WhatsApp
```

La librería coordina manualmente:

- Disponibilidad.
- Costo.
- Modalidad.
- Horario.

No se calcula envío en el portal.

No hay tracking ni integración logística.

---

# 59. Emails

Los emails transaccionales no son requisito del MVP.

La comunicación operativa se concentra en WhatsApp.

Como evolución se podrá incorporar email para:

- Pedido recibido.
- Confirmaciones.
- Facturación.
- Comunicaciones comerciales.

No bloquear el MVP por una integración de email.

---

# 60. Importación y exportación

Debido a que una librería puede manejar muchos productos, el sistema debería estar preparado para incorporar:

- Importación CSV/Excel.
- Exportación de catálogo.
- Actualización masiva de precios.
- Actualización masiva de stock.

Puede ser una fase posterior.

---

# 61. Búsqueda

La búsqueda inicial puede implementarse con PostgreSQL / Supabase.

Debe soportar búsquedas razonables por:

- Nombre.
- SKU.
- ISBN.
- Marca.
- Categoría.
- Autor.

No incorporar un motor externo de búsqueda hasta que exista una necesidad real.

---

# 62. Escalabilidad

No diseñar prematuramente para millones de usuarios.

Sí diseñar correctamente para que pueda crecer.

Principios:

- Código modular.
- Dominio claro.
- Modelo de datos consistente.
- APIs internas bien delimitadas.
- Servicios desacoplados de la UI.
- Tipado fuerte.
- Migraciones versionadas.
- Configuración por ambiente.
- Integraciones encapsuladas.

---

# 63. Entornos

Idealmente:

```text
local
preview
production
```

Vercel deberá utilizar previews para branches / pull requests cuando corresponda.

Supabase deberá manejarse cuidadosamente para evitar que pruebas destruyan información productiva.

---

# 64. Variables de entorno

Ejemplos conceptuales:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

NEXT_PUBLIC_WHATSAPP_NUMBER

# Evolutivos:
# MERCADO_PAGO_ACCESS_TOKEN
# MERCADO_PAGO_WEBHOOK_SECRET
# ARCA_...
```

Nunca commitear secretos.

Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` en cliente.

---

# 65. Convenciones de desarrollo

El proyecto deberá priorizar:

- TypeScript estricto.
- Componentes reutilizables.
- Código legible.
- Separación de responsabilidades.
- Validaciones centralizadas.
- Manejo uniforme de errores.
- Migraciones SQL versionadas.
- Nombres consistentes.
- Evitar `any`.
- Evitar duplicación.
- No sobrearquitecturar.

---

# 66. Validación de datos

Se recomienda disponer de esquemas compartidos de validación.

Ejemplos:

```text
productSchema
customerSchema
checkoutSchema
addressSchema
adminUserSchema
```

Las validaciones del navegador son UX.

Las validaciones del servidor son seguridad e integridad.

Se necesitan ambas.

---

# 67. Principio de fuente de verdad

Nunca utilizar como fuente de verdad:

- Precio enviado por browser.
- Total enviado por browser.
- Descuento calculado únicamente en frontend.
- Stock enviado por browser.
- Rol enviado por browser.

El servidor deberá resolver nuevamente la información crítica desde datos confiables.

---

# 68. Qué NO hacer

La IA no debe:

- Crear microservicios sin necesidad.
- Implementar stock cuantitativo en el MVP.
- Integrar Mercado Pago en el MVP.
- Separar admin y tienda en dos aplicaciones.
- Obligar al comprador a registrarse.
- Crear login tradicional de clientes como requisito del MVP.
- Guardar passwords manualmente.
- Implementar autenticación propia.
- Exponer claves de Mercado Pago.
- Llamar ARCA directamente desde navegador.
- Permitir que el frontend determine el total final.
- Eliminar historial de pedidos al editar productos.
- Hardcodear categorías.
- Hardcodear configuraciones del comercio.
- Diseñar solamente desktop.
- Crear funcionalidades inventadas sin documentarlas.
- Cambiar decisiones arquitectónicas importantes sin explicarlo.

---

# 69. Forma de trabajo esperada de la IA

La IA deberá trabajar de manera incremental.

Antes de escribir grandes cantidades de código:

1. Leer este documento completo.
2. Identificar decisiones tomadas.
3. Detectar ambigüedades reales.
4. Proponer modelo de datos.
5. Proponer estructura del proyecto.
6. Proponer flujo de checkout.
7. Proponer seguridad.
8. Definir MVP.
9. Recién después comenzar implementación.

No deberá preguntar cosas que ya estén respondidas en este documento.

Cuando detecte una decisión pendiente importante deberá indicarla claramente.

---

# 70. Orden de implementación sugerido

```text
1. Base Next.js
2. Design System
3. Supabase
4. Modelo de datos MVP
5. Auth Admin
6. Roles y permisos
7. Layout Admin
8. CRUD Categorías
9. CRUD Productos
10. Storage / imágenes
11. Portal público
12. Catálogo
13. Búsqueda
14. Detalle producto
15. Destacados / novedades
16. Carrito
17. Checkout invitado
18. Clientes
19. Pedidos
20. Configuración de transferencia
21. Integración WhatsApp
22. Dashboard
23. Métricas comerciales básicas
24. Refinamientos UX
```

Evolutivos:

```text
Mercado Pago Checkout Pro
ARCA
Stock cuantitativo
Cuenta de cliente
```

---

# 71. Criterio de éxito del MVP

La primera versión será exitosa cuando funcione este flujo:

```text
ADMIN
 ↓
crea categoría
 ↓
crea producto
 ↓
carga imagen
 ↓
define costo y precio
 ↓
marca disponible
 ↓
publica / destaca


CLIENTE
 ↓
entra sin login
 ↓
encuentra producto
 ↓
carrito
 ↓
checkout
 ↓
completa datos
 ↓
confirma pedido
 ↓
ve alias / datos de transferencia
 ↓
transfiere
 ↓
abre WhatsApp
 ↓
mensaje incluye pedido y total
 ↓
adjunta comprobante
 ↓
coordina retiro


ADMIN
 ↓
ve pedido
 ↓
ve cliente
 ↓
puede abrir WhatsApp
 ↓
finaliza o cancela
```

No se requiere integración automática de pagos para considerar exitoso el MVP.

---

# 72. Decisiones todavía pendientes

### Catálogo

- Cantidad aproximada de productos.
- Códigos de barras.
- Variantes.
- Tamaños / colores / presentaciones.

### Disponibilidad

Ya definido:

```text
No existe stock cuantitativo.
```

Falta decidir si un producto no disponible:

- Se oculta; o
- Se muestra como `Sin disponibilidad`.

### Retiro

Falta definir:

- Dirección.
- Días.
- Horarios.
- Instrucciones.

### Transferencia

Falta definir:

- Alias.
- Titular.
- CBU/CVU si corresponde.
- Banco / billetera.
- Texto de instrucciones.

### WhatsApp

Falta definir:

- Número oficial.
- Mensaje de comprobante.
- Mensaje de consulta de envío.
- Información automática que se incluye.

### Productos

- ¿Libros?
- ISBN.
- Editorial.
- Autor.
- Variantes.

### Comercial

- Nombre definitivo de `Nuestros elegidos`.
- Cantidad de destacados.
- Orden manual.
- Secciones iniciales de Home.

---

# 73. Visión de largo plazo

La visión futura puede evolucionar desde:

```text
E-COMMERCE SIMPLE + ADMIN COMERCIAL
```

hacia una plataforma más completa.

Pero el MVP no debe construir esa visión futura.

La prioridad actual es:

```text
PUBLICAR
 ↓
MOSTRAR
 ↓
PROMOCIONAR
 ↓
VENDER
 ↓
REGISTRAR PEDIDO
 ↓
TRANSFERENCIA
 ↓
WHATSAPP
 ↓
RETIRAR
```

---

# 74. Resumen ejecutivo para una IA

Construir una **única aplicación Next.js full-stack para Librería Blanco**, desplegada en Vercel y utilizando Supabase.

```text
/         → e-commerce público
/admin    → backoffice autenticado
```

## Portal público

- No requiere login.
- Compra como invitado.
- Cliente persistido en `customers`.
- Foco comercial.
- Destacados.
- Novedades.
- Búsqueda.
- Categorías.
- Sin stock cuantitativo.
- Vendible si está publicado + disponible.
- Pago por transferencia.
- Datos de transferencia después de confirmar.
- WhatsApp con pedido + total precompletados.
- Cliente adjunta comprobante.
- Retiro coordinado por WhatsApp.
- Sin tracking.

## Admin

- Supabase Auth.
- Uso sin capacitación.
- Productos.
- Categorías.
- Costos.
- Precios.
- Disponibilidad.
- Destacados.
- Novedades.
- Clientes.
- Pedidos.
- Usuarios.
- Roles.
- Permisos.
- Configuración.
- Datos de transferencia.
- WhatsApp.
- Dashboard.

## Evolutivos

```text
Mercado Pago Checkout Pro
ARCA
Facturación
Stock cuantitativo
Cuenta de cliente
Seguimiento
POS
```

## Principios

```text
SIMPLE
RESPONSIVE
COMERCIAL
SIN CAPACITACIÓN
BAJO COSTO
SEGURO
MANTENIBLE
```

---

# 75. Instrucción final para el agente de IA

**No comenzar construyendo funcionalidades aleatorias.**

Tomar este documento como la **fuente de verdad funcional y arquitectónica inicial del proyecto**.

Ante cualquier contradicción:

1. Priorizar las decisiones marcadas como no negociables.
2. Señalar la contradicción.
3. Proponer alternativas.
4. Solicitar validación antes de modificar una decisión estructural.

El desarrollo deberá realizarse por iteraciones pequeñas, verificables y desplegables.

La prioridad es construir una plataforma real, mantenible y útil para operar diariamente la librería, no solamente una demo visual.

---

# 76. Diseño funcional de la Home — Portal Público

La Home debe estar diseñada con un objetivo comercial claro:

> **Ayudar al cliente a encontrar rápido lo que necesita y, al mismo tiempo, dirigir su atención hacia los productos que la librería desea vender.**

No debe sentirse como una landing institucional ni como un marketplace saturado.

Debe priorizar producto, búsqueda, categorías y compra.

## 76.1 Orden recomendado de la Home

La estructura inicial recomendada es:

```text
┌─────────────────────────────────────────────────────┐
│ BARRA INFORMATIVA                                   │
│ Retiro en el local · ¿Necesitás envío? WhatsApp     │
├─────────────────────────────────────────────────────┤
│ HEADER                                              │
│ Logo     Buscar productos...     WhatsApp   Carrito │
├─────────────────────────────────────────────────────┤
│ HERO COMERCIAL CORTO                                │
│ Mensaje + CTA / campaña actual                      │
├─────────────────────────────────────────────────────┤
│ CATEGORÍAS PRINCIPALES                              │
│ Escolar · Oficina · Artística · Papelería · ...     │
├─────────────────────────────────────────────────────┤
│ NUESTROS ELEGIDOS / DESTACADOS                      │
│ Productos seleccionados manualmente por la librería │
├─────────────────────────────────────────────────────┤
│ NOVEDADES                                           │
├─────────────────────────────────────────────────────┤
│ MÁS BUSCADOS / MÁS VISTOS                           │
├─────────────────────────────────────────────────────┤
│ BLOQUE DE CONFIANZA                                 │
│ Mercado Pago · Retiro local · Consultas WhatsApp    │
├─────────────────────────────────────────────────────┤
│ FOOTER                                              │
└─────────────────────────────────────────────────────┘
```

No es obligatorio que todas las secciones estén activas permanentemente.

El administrador deberá poder controlar qué bloques comerciales se utilizan.

---

# 77. Header del e-commerce

El Header debe ser simple y orientado a compra.

Elementos:

```text
Logo
Buscador
Acceso a WhatsApp
Carrito
```

En desktop podrá incluir categorías o navegación secundaria.

En mobile:

- Logo compacto.
- Carrito visible.
- Buscador muy accesible.
- Menú simple.
- WhatsApp accesible sin competir con el CTA principal de compra.

El buscador es una función primaria, no secundaria.

Placeholder sugerido:

```text
¿Qué estás buscando?
```

o:

```text
Buscar cuadernos, lápices, carpetas...
```

Evitar textos técnicos.

---

# 78. Barra informativa

Sobre el Header se podrá mostrar una barra compacta.

Ejemplo:

```text
Retirá gratis por nuestro local · ¿Necesitás envío? Consultanos por WhatsApp
```

Esta barra debe comunicar inmediatamente las reglas del MVP:

- Retiro en local.
- Consulta de envío por WhatsApp.

En mobile el texto deberá simplificarse si fuera necesario.

---

# 79. Hero comercial

El Hero no debe ocupar una pantalla completa.

La prioridad del sitio es llegar rápido al producto.

El Hero debe ser:

- Compacto.
- Visual.
- Fácil de actualizar.
- Orientado a una campaña o mensaje comercial.

Ejemplos:

```text
Todo para volver al cole
Encontrá útiles, cuadernos y mucho más.
[Ver productos]
```

```text
Nuevos ingresos
Descubrí lo último que llegó a Librería Blanco.
[Ver novedades]
```

La arquitectura deberá permitir cambiar:

- Título.
- Texto.
- Imagen.
- CTA.
- Link.
- Estado activo.

En una primera versión puede existir un único Hero administrable.

No es necesario construir un CMS complejo.

---

# 80. Categorías principales

Las categorías deben facilitar la navegación rápida.

En Home se mostrarán solamente las más relevantes.

Ejemplo visual:

```text
[ 🎒 Escolar ]
[ ✏️ Escritura ]
[ 🎨 Artística ]
[ 📒 Cuadernos ]
[ 📁 Oficina ]
[ 🎁 Regalería ]
```

Las categorías podrán representarse mediante:

- Imagen.
- Ícono.
- Nombre.

Las libreras deberán poder definir qué categorías aparecen destacadas y en qué orden.

---

# 81. Destacados comerciales

Esta es una funcionalidad central.

El nombre visible puede ser:

```text
Nuestros elegidos
Recomendados
Destacados
Lo que no te puede faltar
```

El nombre definitivo se definirá según la identidad de Librería Blanco.

## Objetivo

Permitir que la librería impulse productos específicos independientemente de sus ventas o búsquedas reales.

Ejemplos:

- Producto con mejor margen.
- Mercadería que se desea rotar.
- Producto nuevo.
- Producto de temporada.
- Producto estratégico.
- Producto con mucho stock.

## Administración

Desde el formulario de producto deberá existir una acción extremadamente simple:

```text
☑ Destacar en la tienda
```

Opcionalmente:

```text
Orden del destacado: 1
```

También debería existir desde la lista de productos una acción rápida:

```text
☆ Destacar
★ Destacado
```

Sin necesidad de entrar al formulario completo.

## Importante

Esto **no es una lista de favoritos personales del comprador**.

En el MVP no se implementará wishlist de cliente.

---

# 82. Más buscados, más vistos y más vendidos

Estas secciones son distintas de los destacados manuales.

## Más buscados

Representa términos o productos con mayor actividad de búsqueda.

## Más vistos

Productos cuyas fichas reciben más visitas.

## Más vendidos

Productos con mayor cantidad de unidades vendidas.

La implementación inicial debe ser simple.

No utilizar Machine Learning ni servicios externos.

Se podrán utilizar:

- Contadores.
- Eventos.
- Agregaciones SQL.
- Vistas o consultas de PostgreSQL.

La Home puede mostrar solamente una o dos de estas secciones para evitar saturación.

---

# 83. Novedades

Debe existir una forma sencilla de mostrar productos nuevos.

Puede resolverse inicialmente mediante:

- Fecha de publicación.
- Flag manual `is_new`.
- Combinación de ambos.

La administradora debería poder decidir si desea marcar manualmente:

```text
☑ Mostrar como novedad
```

---

# 84. Cards de producto

Las cards son uno de los componentes más importantes del portal.

Deben mostrar solamente información útil.

Ejemplo:

```text
┌──────────────────────┐
│                      │
│       IMAGEN         │
│                      │
│ Cuaderno Rivadavia   │
│ A4 · 80 hojas        │
│                      │
│ $ 12.500             │
│                      │
│ [Agregar al carrito] │
└──────────────────────┘
```

Opcionalmente:

- Badge `Nuevo`.
- Badge `Destacado`.
- Badge `Oferta`.
- Estado `Sin stock`.

Evitar:

- Exceso de etiquetas.
- Información administrativa.
- SKU visible sin necesidad.
- Margen.
- Costo.
- Stock numérico interno.

El cliente solo necesita saber si está disponible.

---

# 85. Detalle de producto

La ficha de producto deberá priorizar:

1. Imagen.
2. Nombre.
3. Precio.
4. Disponibilidad.
5. Descripción útil.
6. Cantidad.
7. Agregar al carrito.
8. Consulta por WhatsApp.

Estructura:

```text
IMÁGENES            NOMBRE
                    PRECIO
                    DISPONIBILIDAD

                    Descripción

                    [-] 1 [+]

                    [ AGREGAR AL CARRITO ]

                    ¿Tenés una consulta?
                    [ Hablar por WhatsApp ]
```

Debajo:

```text
También te puede interesar
```

Las recomendaciones relacionadas podrán basarse inicialmente en categoría.

---

# 86. Carrito

El carrito debe ser extremadamente claro.

Mostrar:

- Producto.
- Cantidad.
- Precio unitario.
- Subtotal.
- Total.
- Eliminar.
- Continuar comprando.
- Finalizar compra.

Mensaje visible:

```text
Retiro sin cargo en el local.
¿Necesitás envío? Consultanos por WhatsApp.
```

CTA principal:

```text
Continuar con la compra
```

No introducir upselling agresivo que dificulte finalizar.

---

# 87. Checkout

El checkout deberá idealmente resolverse en una única pantalla o en muy pocos pasos.

Prioridad:

```text
1. Tus datos
2. Retiro
3. Pago
```

Ejemplo:

```text
Tus datos
──────────────
Nombre
Apellido
Email
Teléfono
DNI / CUIT cuando corresponda

Retiro
──────────────
✓ Retiro en Librería Blanco
Dirección
Horario

Resumen
──────────────
Productos
Total

[ PAGAR CON MERCADO PAGO ]
```

No solicitar información que no sea necesaria.

No pedir dirección de envío.

No pedir contraseña.

---

# 88. WhatsApp — experiencia comercial

WhatsApp es parte de la experiencia del portal, no solamente un enlace de contacto.

Usos principales:

### Consulta general

```text
Hola, quería hacer una consulta.
```

### Consulta desde producto

```text
Hola, quería consultar por:
Cuaderno Rivadavia A4
```

### Consulta por envío desde carrito

```text
Hola, quisiera consultar si pueden realizar el envío de estos productos:
- Producto A x 2
- Producto B x 1
```

### Consulta después de comprar

```text
Hola, hice el pedido #1234 y quisiera consultar por la posibilidad de envío.
```

El enlace deberá generarse dinámicamente y codificar correctamente el mensaje.

No incluir datos sensibles.

---

# 89. Diseño funcional del Admin

El Admin debe responder a una filosofía:

> **Una persona sin conocimientos técnicos debe entender qué hacer sin manual ni capacitación.**

La navegación propuesta para el MVP:

```text
Inicio
Productos
Stock
Pedidos
Clientes
Facturación
Usuarios
Configuración
```

`Usuarios` podrá ser visible solamente para perfiles autorizados.

Funciones futuras no deben aparecer deshabilitadas ocupando espacio.

Si todavía no existe una funcionalidad, no mostrarla.

---

# 90. Home del Admin

La pantalla inicial debe ser un **centro de trabajo**.

```text
┌─────────────────────────────────────────────────────────┐
│ Hola 👋                                                 │
│ ¿Qué necesitás hacer?                                   │
│                                                         │
│ [ + Agregar producto ]                                  │
├─────────────────────────────────────────────────────────┤
│ PEDIDOS NUEVOS                                          │
│                                                         │
│ 4 pedidos                                               │
│                                                         │
│ [Ver pedidos]                                           │
├─────────────────────────────────────────────────────────┤
│ PRODUCTOS                                               │
│                                                         │
│ 145 publicados                                          │
│ 7 no disponibles                                        │
│                                                         │
│ [Ver productos]                                         │
├─────────────────────────────────────────────────────────┤
│ HOY                                                     │
│                                                         │
│ 5 pedidos · $125.300                                    │
└─────────────────────────────────────────────────────────┘
```

No priorizar gráficos.

---

# 91. Productos — pantalla principal

Elementos:

```text
Productos                              [+ Agregar producto]

[ Buscar producto... ]

Todos | Publicados | No disponibles | Destacados

----------------------------------------------------------
Foto | Producto | Precio | Disponible | Estado | Acciones
----------------------------------------------------------
```

Acciones rápidas:

```text
Editar
Cambiar precio
Disponible / No disponible
Destacar / quitar destacado
Publicar / despublicar
```

No obligar a abrir el producto para tareas simples.

En mobile, transformar la tabla en cards legibles.

---

# 92. Alta y edición de producto

El formulario debe estar orientado a una librera.

## Información principal

```text
Nombre del producto *
Categoría *
Descripción
Foto
```

## Precio

```text
¿Cuánto te cuesta?        $ ______
¿A cuánto lo vendés?      $ ______

Ganás por unidad:         $ ______
Eso representa:           __ % del precio
```

## Tienda online

```text
☑ Disponible en la tienda
☑ Mostrar en la tienda
☐ Destacar en la página principal
☐ Mostrar como novedad
```

## Información adicional

En una sección colapsable `Más datos`:

- SKU.
- ISBN.
- Código de barras.
- Marca.
- Autor.
- Editorial.
- Tags.

CTA:

```text
[ Guardar producto ]
```

No solicitar stock numérico.

---

# 93. Stock — experiencia simplificada

La plataforma no administrará cantidades de stock.

Desde Productos deberá cambiarse la disponibilidad rápidamente:

```text
Cuaderno Rivadavia A4

Disponible en la tienda      [ Sí ]
```

Lista:

```text
Producto                  Precio        Disponible
--------------------------------------------------
Cuaderno Rivadavia        $12.500          ● Sí
Lápiz negro               $ 1.500          ● Sí
Carpeta N°3               $ 4.200          ○ No
```

No utilizar terminología de inventario.

---

# 94. Pedidos — experiencia simplificada

Filtros:

```text
Nuevos
Finalizados
Cancelados
Todos
```

Pedido:

```text
Pedido #LB-1042
María González
3 productos
$25.300
Nuevo

[ Ver pedido ]
```

Detalle:

```text
Pedido #LB-1042

Cliente
María González
11 5555-5555
maria@email.com

Productos
2 x Cuaderno ...
1 x Lápiz ...

Total
$25.300

Pago
Transferencia

[ ABRIR WHATSAPP ]

[ FINALIZAR PEDIDO ]
[ CANCELAR ]
```

La validación del comprobante y coordinación del retiro se realizan por WhatsApp.

---

# 95. Clientes — experiencia simplificada

La pantalla será principalmente de consulta.

```text
Clientes

[ Buscar por nombre, teléfono o email ]

María González
11 5555-5555
3 compras
Última compra: 20/08/2026
```

Al entrar:

```text
Datos
Historial de compras
Facturas
Total comprado
```

No convertir este módulo en un CRM complejo.

---

# 96. Usuarios y Roles

Visible para `SUPER_ADMIN` y otros perfiles con permiso.

## Usuarios

```text
Usuarios                         [+ Crear usuario]

Ana       Administradora      Activa
Laura     Vendedora           Activa
Marta     Solo lectura        Activa
```

## Roles

```text
Roles                            [+ Crear rol]

Administradora
Vendedora
Solo lectura
```

Crear rol:

```text
Nombre del rol:
[ Stock ]

¿Qué puede hacer?

                  Ver   Crear   Editar   Eliminar/Anular
Productos          ✓      -       -            -
Stock              ✓      ✓       ✓            -
Pedidos            ✓      -       -            -
Clientes           -      -       -            -
Facturación        -      -       -            -
```

La configuración debe ser visual.

---

# 97. Configuración del negocio

## Librería

```text
Nombre
Logo
Dirección
Horarios
Teléfono
Email
```

## WhatsApp

```text
Número
Mensaje general
Mensaje para comprobante
Mensaje para consulta de envío
```

## Transferencia

```text
Alias
Titular
CBU / CVU
Banco / billetera
Instrucciones
```

## Tienda

```text
Título de Home
Texto del Hero
Imagen del Hero
Categorías destacadas
```

## Evolutivos

```text
Mercado Pago → Evolutivo
ARCA → Evolutivo
```

No mostrar configuraciones técnicas de integraciones inexistentes.

---

# 98. Estados vacíos

Toda pantalla deberá diseñar explícitamente su estado sin datos.

Ejemplo Productos:

```text
Todavía no cargaste productos.

Agregá el primero para empezar a armar tu tienda.

[ + Agregar producto ]
```

Pedidos:

```text
No hay pedidos nuevos 🎉
```

Stock:

```text
No hay productos con poco stock.
```

Los empty states deben explicar qué ocurre y, cuando corresponda, qué acción puede realizarse.

---

# 99. Mensajes de confirmación

Los mensajes deben hablar el lenguaje del negocio.

Correcto:

```text
Producto guardado.
```

```text
Agregaste 20 unidades al stock.
```

```text
El pedido #1042 está listo para retirar.
```

Incorrecto:

```text
Entity successfully updated.
```

```text
Mutation executed successfully.
```

---

# 100. Prevención de errores administrativos

Debido a que no habrá capacitación, el sistema deberá prevenir errores comunes.

Ejemplos:

### Precio de venta menor al costo

Mostrar:

```text
⚠ El precio de venta es menor al costo.
Vas a perder $350 por unidad.

¿Querés guardar igualmente?
```

### Stock negativo

No permitir stock negativo salvo flujo explícitamente autorizado.

### Eliminar producto vendido

No eliminar físicamente.

Mostrar:

```text
Este producto tiene ventas registradas.
Podés ocultarlo de la tienda, pero no eliminar su historial.
```

### Salir con cambios sin guardar

Advertir antes de perder información.

---

# 101. Diseño responsive — criterios concretos

## Breakpoints

La implementación podrá utilizar los breakpoints del sistema de diseño adoptado, pero deberá verificarse visualmente como mínimo en:

```text
360 px
390 px
768 px
1024 px
1440 px
```

No diseñar solamente en 1440px y asumir que responsive funciona.

## Mobile

Priorizar:

- Contenido en una columna.
- Formularios fáciles de completar.
- Botones de ancho adecuado.
- Evitar tablas horizontales imposibles de leer.
- Header compacto.
- Carrito accesible.
- Buscador accesible.
- CTA principal visible.

## Desktop

Utilizar el espacio adicional para mejorar lectura y productividad, no simplemente agrandar componentes.

---

# 102. Design System

Antes de construir todas las pantallas, definir un pequeño Design System.

Debe incluir como mínimo:

```text
Colors
Typography
Spacing
Border radius
Shadows
Buttons
Inputs
Select
Checkbox
Radio
Switch
Cards
Badges
Alerts
Modal
Drawer
Table
Tabs
Toast
Skeleton
Empty State
```

El diseño público podrá tener más personalidad comercial.

El Admin deberá reutilizar los mismos foundations pero ser más funcional.

No construir cada pantalla con estilos independientes.

---

# 103. UX Writing

Los textos deben ser:

- Cortos.
- Claros.
- Humanos.
- En español.
- Sin tecnicismos.
- Consistentes.

Ejemplos:

```text
Agregar producto
Cambiar precio
Agregar stock
Guardar cambios
Listo para retirar
Hablar por WhatsApp
```

Evitar:

```text
Submit
Update
Edit entity
Inventory adjustment
Fulfillment status
```

---

# 104. Criterios de aceptación UX del MVP

Una persona sin explicación previa deberá poder:

### Admin

- Iniciar sesión.
- Agregar producto.
- Subir foto.
- Definir costo y precio.
- Entender cuánto gana.
- Marcar disponible / no disponible.
- Destacar producto.
- Encontrar pedido.
- Abrir WhatsApp.
- Finalizar pedido.
- Buscar cliente.

### Cliente

- Entender qué vende la librería.
- Encontrar producto.
- Ver precio.
- Saber si está disponible.
- Agregar al carrito.
- Comprar sin registrarse.
- Ver datos de transferencia.
- Entender cómo enviar el comprobante.
- Abrir WhatsApp con el pedido identificado.
- Entender que retira en el local.
- Consultar envío por WhatsApp.

Si alguno de estos flujos requiere instrucciones externas, revisar la UX.

---

# 105. Prioridades de diseño

En caso de conflicto entre decisiones, utilizar este orden:

```text
1. FACILIDAD DE USO
2. CLARIDAD
3. CONVERSIÓN / OBJETIVO COMERCIAL
4. ACCESIBILIDAD
5. PERFORMANCE
6. CONSISTENCIA
7. ESTÉTICA
8. EFECTOS / ANIMACIONES
```

La interfaz debe verse bien, pero nunca sacrificar claridad por una estética llamativa.

---

# 106. Definición final del MVP visual

La experiencia buscada puede resumirse así:

## Para el cliente

> **Una librería online cálida, moderna y rápida, donde encuentro lo que necesito, descubro productos recomendados, hago mi pedido sin crear una cuenta y termino la coordinación fácilmente por WhatsApp.**

## Para la administradora

> **Un sistema tan simple que puedo administrar productos, precios, stock y pedidos sin haber recibido capacitación.**

Estas dos frases deben utilizarse como criterio de diseño durante toda la implementación.
