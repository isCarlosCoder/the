// src/index.js

const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 8182;
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para parsear o corpo das requisições
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Configuração da sessão
app.use(session({
  secret: '25f3a487b127ef54802e4d79a0a3b08a8a894b75', // Troque por uma chave secreta mais segura
  resave: true,
  saveUninitialized: true,
}));

// Middleware para verificar se o usuário está autenticado
function isAuthenticated(req, res, next) {
  // Se o usuário está autenticado, continua
  if (req.session.isAdmin) {
    return next(); 
  }

  // Se a rota for de login (/admin), permite acesso
  if (req.path === '/admin' || req.path === '/admin/login') {
    return next(); 
  }

  // Se não estiver autenticado e a rota contém "admin", redireciona para a página de login
  if (req.path.includes('/admin')) {
    return res.redirect('/admin'); 
  }
  
  next(); // Acesso livre para outras rotas
}

function generateIdFromTitle(title) {
  return title
    .toLowerCase() // Converte o título para minúsculas
    .normalize('NFD') // Normaliza o título para remover acentuações
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos (acentos)
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais, mantendo apenas letras, números e espaços
    .trim() // Remove espaços em branco do início e do fim
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens duplicados
    .replace(/^-|-$/g, ''); // Remove hífens do início e do fim
}

function formatDate(createdAt) {
    const date = new Date(createdAt);
    const day = String(date.getDate()).padStart(2, '0'); // Pega o dia e adiciona zero à esquerda se necessário
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Pega o mês (0-11) e adiciona zero à esquerda
    const year = date.getFullYear(); // Pega o ano
    const hours = String(date.getHours()).padStart(2, '0'); // Pega as horas e adiciona zero à esquerda
    const minutes = String(date.getMinutes()).padStart(2, '0'); // Pega os minutos e adiciona zero à esquerda

    return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

// Aplicar middleware de autenticação
app.use(isAuthenticated);

// Rota principal
app.get('/', async (req, res) => {
  const categories = await prisma.category.findMany()
  const posts = await prisma.post.findMany()

  res.render('index', {
    postsCount: posts.length,
    categoriesCount: categories.length,
    posts,
    formatDate
  }); // Renderiza a página principal
});

app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (post) {
      res.render('post', { post });
    } else {
      res.status(404).send('Publicação não encontrada.');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar a publicação.');
  }
});


// Rota para a página de login do admin
app.get('/admin', (req, res) => {
  res.render('admin/index'); // Renderiza a página de login do admin
});

// Rota para autenticar o admin
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  // Aqui você deve verificar as credenciais (substitua pelo seu método de autenticação)
  if (username === 'admin' && password === 'senha') {
    req.session.isAdmin = true; // Armazena que o usuário está autenticado
    return res.redirect('/admin/dashboard'); // Redireciona para o dashboard
  }


  res.redirect('/admin'); // Se as credenciais estiverem erradas, redireciona para a página de login
});

// Rota para o dashboard do admin
app.get('/admin/dashboard', async (req, res) => {
  const categories = await prisma.category.findMany()
  const posts = await prisma.post.findMany()

  res.render('admin/dashboard', {
    postsCount: posts.length,
    categoriesCount: categories.length,
    posts,
    formatDate
  }); // Renderiza a página do dashboard
});

app.get('/admin/new', async (req, res) => {
  const categories = await prisma.category.findMany()
  const { type } = req.query

  const cat = []

  categories.forEach(category => {
    cat.push(category.name)
  })

  if (type == 'post' || type == 'tag' || type == 'category') {
    res.render('admin/new', {
      categories: cat
    })
  } else {
    res.redirect('admin/dashboard')
  }
})

app.post('/admin/new', async (req, res) => {
  const { title, category, content, text } = req.body

  if (!title || !category || !content) {
    return res.redirect('/admin/dashboard')
  }

  const data = {
    id: generateIdFromTitle(title),
    title,
    category,
    content,
    text
  }

  await prisma.post.create({ data })
  res.redirect('/admin/dashboard')
})

app.get('/admin/delete/:postid', async (req, res) => {
  const { postid } = req.params

  const exists = await prisma.post.findFirst({
    where: {
      id: postid
    }
  })

  if (!exists) {
    return res.redirect('/admin/dashboard')
  }

  await prisma.post.delete({
    where: {
      id: postid
    }
  })

  res.redirect('/admin/dashboard')
})

app.get('/admin/delete/category/:categoryId', async (req, res) => {
  const { categoryId } = req.params

  const exists = await prisma.category.findFirst({
    where: {
      id: categoryId
    }
  })

  if (!exists) {
    return res.redirect('/admin/categories')
  }

  await prisma.category.delete({
    where: {
      id: categoryId
    }
  })

  res.redirect('/admin/categories')
})

app.post('/admin/new/category', async (req, res) => {
  const { name } = req.body

  if (!name) {
    return res.redirect('admin/dashboard')
  }

  const existsCategory = await prisma.category.findFirst({
    where: {
      name
    }
  })

  if (existsCategory) {
    return res.redirect('admin/dashboard')
  }

  await prisma.category.create({
    data: {
      name
    }
  })

  res.redirect('/admin/dashboard')
})

app.get('/admin/categories', async (req, res) => {
  const categories = await prisma.category.findMany()

  res.render('admin/categories', {
    categories,
    formatDate
  })
})

// Rota para deslogar
app.post('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/admin/dashboard'); // Se houver erro, redireciona para o dashboard
    }
    res.redirect('/admin'); // Redireciona para a página de login
  });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
