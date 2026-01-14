import "dotenv/config";
import { prisma } from "@/lib/db";

const IMAGE_URL = "https://pankhuri-v3.blr1.cdn.digitaloceanspaces.com/dev/category-icons/1764848146087_pfp.jpg";

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing data in proper order (respecting foreign key constraints)
  console.log("🗑️  Clearing existing data...");
  await prisma.courseReview.deleteMany();
  await prisma.userLessonProgress.deleteMany();
  await prisma.userCourseProgress.deleteMany();
  await prisma.userStreak.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.lessonAttachment.deleteMany();
  await prisma.lessonDescription.deleteMany();
  await prisma.textLesson.deleteMany();
  await prisma.videoLesson.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.video.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.category.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.userSubscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Users
  console.log("👤 Creating users...");
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@pankhuri.com",
        phone: "+919876543210",
        displayName: "Admin User",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1990-01-15"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "admin",
        status: "active",
        profession: "Administrator",
      },
    }),
    prisma.user.create({
      data: {
        email: "trainer1@pankhuri.com",
        phone: "+919876543211",
        displayName: "Priya Sharma",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1985-03-20"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
        profession: "Fitness Trainer",
      },
    }),
    prisma.user.create({
      data: {
        email: "trainer2@pankhuri.com",
        phone: "+919876543212",
        displayName: "Anjali Mehta",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1988-07-10"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "hi",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
        profession: "Nutrition Expert",
      },
    }),
    prisma.user.create({
      data: {
        email: "trainer3@pankhuri.com",
        phone: "+919876543216",
        displayName: "Meera Kapoor",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1987-09-12"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
        profession: "Life Coach",
      },
    }),
    prisma.user.create({
      data: {
        email: "student1@example.com",
        phone: "+919876543213",
        displayName: "Neha Gupta",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1995-05-15"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
        profession: "Software Engineer",
      },
    }),
    prisma.user.create({
      data: {
        email: "student2@example.com",
        phone: "+919876543214",
        displayName: "Ritu Singh",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1992-11-25"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "hi",
        isEmailVerified: true,
        isPhoneVerified: false,
        role: "user",
        status: "active",
        profession: "Teacher",
      },
    }),
    prisma.user.create({
      data: {
        email: "student3@example.com",
        phone: "+919876543215",
        displayName: "Kavita Reddy",
        profileImage: IMAGE_URL,
        dateOfBirth: new Date("1998-02-28"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: false,
        isPhoneVerified: true,
        role: "user",
        status: "active",
        profession: "Marketing Manager",
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // 2. Create Trainers
  console.log("🎓 Creating trainers...");
  const trainers = await Promise.all([
    prisma.trainer.create({
      data: {
        userId: users[1].id, // Priya Sharma
        bio: "Certified fitness trainer and yoga instructor with over 12 years of experience. Passionate about helping women achieve their fitness goals through sustainable and enjoyable workout routines.",
        specialization: ["Yoga", "Strength Training", "Flexibility", "Mindfulness"],
        experience: 12,
        rating: 4.8,
        totalStudents: 2500,
        socialLinks: {
          linkedin: "https://linkedin.com/in/priya-sharma",
          instagram: "https://instagram.com/priya.fitness",
          website: "https://priyafitness.com",
        },
        status: "active",
      },
    }),
    prisma.trainer.create({
      data: {
        userId: users[2].id, // Anjali Mehta
        bio: "Nutritionist and wellness coach specializing in healthy lifestyle transformations. Helps people develop sustainable eating habits and improve their relationship with food.",
        specialization: ["Nutrition", "Weight Management", "Healthy Cooking", "Lifestyle Coaching"],
        experience: 8,
        rating: 4.9,
        totalStudents: 1800,
        socialLinks: {
          instagram: "https://instagram.com/anjali.nutrition",
          facebook: "https://facebook.com/anjalimehta.nutrition",
        },
        status: "active",
      },
    }),
    prisma.trainer.create({
      data: {
        userId: users[3].id, // Meera Kapoor
        bio: "Certified life coach and personal development expert. Specializes in helping women build confidence, set goals, and create meaningful life changes through mindset work and practical strategies.",
        specialization: ["Life Coaching", "Personal Development", "Goal Setting", "Confidence Building"],
        experience: 6,
        rating: 4.7,
        totalStudents: 950,
        socialLinks: {
          linkedin: "https://linkedin.com/in/meera-kapoor",
          website: "https://meeracoach.com",
        },
        status: "active",
      },
    }),
  ]);

  console.log(`✅ Created ${trainers.length} trainers`);

  // 3. Create Categories
  console.log("📁 Creating categories...");
  const parentCategories = await Promise.all([
    prisma.category.create({
      data: {
        name: "Fitness & Yoga",
        slug: "fitness-yoga",
        description: "Workout routines, yoga practices, and fitness programs for all levels",
        icon: IMAGE_URL,
        status: "active",
        sequence: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: "Nutrition & Wellness",
        slug: "nutrition-wellness",
        description: "Healthy eating, meal planning, and overall wellness guidance",
        icon: IMAGE_URL,
        status: "active",
        sequence: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: "Personal Development",
        slug: "personal-development",
        description: "Self-improvement, confidence building, and life skills development",
        icon: IMAGE_URL,
        status: "active",
        sequence: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: "Lifestyle & Hobbies",
        slug: "lifestyle-hobbies",
        description: "Creative pursuits, hobbies, and lifestyle enhancement",
        icon: IMAGE_URL,
        status: "active",
        sequence: 4,
      },
    }),
  ]);

  // Create subcategories
  const subCategories = await Promise.all([
    prisma.category.create({
      data: {
        parentId: parentCategories[0].id,
        name: "Beginner Yoga",
        slug: "beginner-yoga",
        description: "Yoga practices for beginners and newcomers",
        icon: IMAGE_URL,
        status: "active",
        sequence: 1,
      },
    }),
    prisma.category.create({
      data: {
        parentId: parentCategories[0].id,
        name: "Strength Training",
        slug: "strength-training",
        description: "Building strength and muscle with safe, effective workouts",
        icon: IMAGE_URL,
        status: "active",
        sequence: 2,
      },
    }),
    prisma.category.create({
      data: {
        parentId: parentCategories[1].id,
        name: "Healthy Cooking",
        slug: "healthy-cooking",
        description: "Learn to prepare nutritious and delicious meals",
        icon: IMAGE_URL,
        status: "active",
        sequence: 1,
      },
    }),
    prisma.category.create({
      data: {
        parentId: parentCategories[2].id,
        name: "Confidence Building",
        slug: "confidence-building",
        description: "Build self-confidence and overcome limiting beliefs",
        icon: IMAGE_URL,
        status: "active",
        sequence: 1,
      },
    }),
  ]);

  console.log(
    `✅ Created ${parentCategories.length} parent categories and ${subCategories.length} subcategories`
  );

  // 4. Create Videos (leaving empty as requested)
  console.log("🎬 Creating placeholder videos...");
  const videos = await Promise.all([
    prisma.video.create({
      data: {
        title: "Introduction to Yoga",
        thumbnailUrl: IMAGE_URL,
        storageKey: "",
        playbackUrl: null,
        status: "uploading",
        duration: null,

      },
    }),
    prisma.video.create({
      data: {
        title: "Strength Training Basics",
        thumbnailUrl: IMAGE_URL,
        storageKey: "",
        playbackUrl: null,
        status: "uploading",
        duration: null,
        // 
      },
    }),
    prisma.video.create({
      data: {
        title: "Cooking Demonstration",
        thumbnailUrl: IMAGE_URL,
        storageKey: "",
        playbackUrl: null,
        status: "uploading",
        duration: null,
        // 
      },
    }),
    prisma.video.create({
      data: {
        title: "Confidence Workshop",
        thumbnailUrl: IMAGE_URL,
        storageKey: "",
        playbackUrl: null,
        status: "uploading",
        duration: null,

      },
    }),
    prisma.video.create({
      data: {
        title: "Course Demo Video",
        thumbnailUrl: IMAGE_URL,
        storageKey: "",
        playbackUrl: null,
        status: "uploading",
        duration: null,

      },
    }),
  ]);

  console.log(`✅ Created ${videos.length} videos`);

  // 5. Create Courses
  console.log("📚 Creating courses...");
  const courses = await Promise.all([
    prisma.course.create({
      data: {
        categoryId: subCategories[0].id, // Beginner Yoga
        trainerId: trainers[0].id,
        demoVideoId: videos[4].id,
        title: "Yoga for Beginners: Complete Foundation",
        slug: "yoga-for-beginners-complete-foundation",
        description:
          "A comprehensive yoga course designed for complete beginners. Learn fundamental poses, breathing techniques, and build a sustainable practice from the ground up.",
        thumbnailImage: IMAGE_URL,
        coverImage: IMAGE_URL,
        level: "beginner",
        duration: 480, // 8 hours
        language: "en",
        status: "active",
        hasCertificate: true,
        rating: 4.8,
        averageRating: 4.8,
        totalReviews: 125,
        tags: ["beginner", "yoga", "flexibility", "wellness", "mindfulness"],
        metadata: {
          prerequisites: [],
          targetAudience: "Complete beginners to yoga",
          whatYouWillLearn: [
            "Basic yoga poses and alignment",
            "Breathing techniques and meditation",
            "Building flexibility and strength",
            "Creating a daily practice routine",
            "Understanding yoga philosophy",
          ],
        },
      },
    }),
    prisma.course.create({
      data: {
        categoryId: subCategories[1].id, // Strength Training
        trainerId: trainers[0].id,
        demoVideoId: videos[4].id,
        title: "Women's Strength Training Program",
        slug: "womens-strength-training-program",
        description:
          "Build strength, confidence, and transform your body with this comprehensive strength training program designed specifically for women. No gym intimidation, just results.",
        thumbnailImage: IMAGE_URL,
        coverImage: IMAGE_URL,
        level: "beginner",
        duration: 360, // 6 hours
        language: "en",
        status: "active",
        hasCertificate: true,
        rating: 4.9,
        averageRating: 4.9,
        totalReviews: 89,
        tags: ["strength", "fitness", "beginner-friendly", "confidence", "transformation"],
        metadata: {
          prerequisites: ["No prior experience needed"],
          targetAudience: "Women wanting to start strength training",
          whatYouWillLearn: [
            "Proper form and technique",
            "Progressive workout routines",
            "Home and gym workout options",
            "Nutrition for strength building",
            "Overcoming gym anxiety",
          ],
        },
      },
    }),
    prisma.course.create({
      data: {
        categoryId: subCategories[2].id, // Healthy Cooking
        trainerId: trainers[1].id,
        demoVideoId: videos[4].id,
        title: "Healthy Cooking Mastery",
        slug: "healthy-cooking-mastery",
        description:
          "Transform your kitchen skills and learn to create delicious, nutritious meals that fuel your body and satisfy your taste buds. Perfect for busy lifestyles.",
        thumbnailImage: IMAGE_URL,
        coverImage: IMAGE_URL,
        level: "beginner",
        duration: 240, // 4 hours
        language: "en",
        status: "active",
        hasCertificate: true,
        rating: 4.7,
        averageRating: 4.7,
        totalReviews: 156,
        tags: ["cooking", "nutrition", "meal-prep", "healthy-eating", "lifestyle"],
        metadata: {
          prerequisites: [],
          targetAudience: "Anyone wanting to improve their cooking and nutrition",
          whatYouWillLearn: [
            "Essential cooking techniques",
            "Meal planning and preparation",
            "Understanding nutrition basics",
            "Quick and healthy recipes",
            "Kitchen organization tips",
          ],
        },
      },
    }),
    prisma.course.create({
      data: {
        categoryId: subCategories[3].id, // Confidence Building
        trainerId: trainers[2].id,
        demoVideoId: videos[4].id,
        title: "Build Unshakeable Confidence",
        slug: "build-unshakeable-confidence",
        description:
          "Overcome self-doubt and build lasting confidence through proven techniques, mindset shifts, and practical exercises. Transform how you show up in the world.",
        thumbnailImage: IMAGE_URL,
        coverImage: IMAGE_URL,
        level: "beginner",
        duration: 180, // 3 hours
        language: "en",
        status: "active",
        hasCertificate: false,
        rating: 4.8,
        averageRating: 4.8,
        totalReviews: 92,
        tags: ["confidence", "self-development", "mindset", "personal-growth", "empowerment"],
        metadata: {
          prerequisites: [],
          targetAudience: "Women looking to build confidence and self-esteem",
          whatYouWillLearn: [
            "Understanding confidence vs self-esteem",
            "Overcoming limiting beliefs",
            "Building positive self-talk",
            "Body language and presence",
            "Setting and achieving goals",
          ],
        },
      },
    }),
  ]);

  console.log(`✅ Created ${courses.length} courses`);

  // 6. Create Modules and Lessons for Course 1 (Beginner Yoga)
  console.log("📖 Creating modules and lessons for Course 1...");

  const course1Module1 = await prisma.module.create({
    data: {
      courseId: courses[0].id,
      title: "Yoga Fundamentals",
      slug: "yoga-fundamentals",
      description: "Learn the basics of yoga practice, breathing, and alignment",
      sequence: 1,
      duration: 120,
      status: "published",
      metadata: {
        learningObjectives: [
          "Understand yoga basics and philosophy",
          "Learn proper breathing techniques",
          "Master fundamental poses",
        ],
      },
    },
  });

  const course1Module2 = await prisma.module.create({
    data: {
      courseId: courses[0].id,
      title: "Building Flexibility",
      slug: "building-flexibility",
      description: "Gentle stretches and poses to improve flexibility safely",
      sequence: 2,
      duration: 180,
      status: "published",
      metadata: {
        learningObjectives: [
          "Improve overall flexibility",
          "Learn safe stretching techniques",
          "Develop body awareness",
        ],
      },
    },
  });

  const course1Module3 = await prisma.module.create({
    data: {
      courseId: courses[0].id,
      title: "Strength & Balance",
      slug: "strength-balance",
      description: "Build strength and improve balance through yoga practice",
      sequence: 3,
      duration: 180,
      status: "published",
      metadata: {
        learningObjectives: [
          "Develop core strength",
          "Improve balance and coordination",
          "Build confidence in poses",
        ],
      },
    },
  });

  // Create lessons for Course 1
  const course1Lessons = [];

  // Lesson 1 - Video
  const lesson1 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module1.id,
      title: "Welcome to Yoga",
      slug: "welcome-to-yoga",
      type: "video",
      description: "An introduction to yoga and what you can expect from this course",
      sequence: 1,
      duration: 15,
      isFree: true,
      status: "published",
      metadata: {
        difficulty: "easy",
      },
    },
  });
  course1Lessons.push(lesson1);

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson1.id,
      textContent:
        "<p>Welcome to your yoga journey! In this introductory lesson, we'll cover:</p><ul><li>What yoga is and its benefits</li><li>Setting up your practice space</li><li>What equipment you'll need</li><li>How to approach your practice safely</li></ul><p>Remember to listen to your body and never force any movements.</p>",
    },
  });

  // Lesson 2 - Text
  const lesson2 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module1.id,
      title: "Understanding Your Body",
      slug: "understanding-your-body",
      type: "text",
      description: "Learn about body awareness and listening to your limits",
      sequence: 2,
      duration: 15,
      isFree: true,
      status: "published",
    },
  });
  course1Lessons.push(lesson2);

  await prisma.textLesson.create({
    data: {
      lessonId: lesson2.id,
      content: `# Understanding Your Body in Yoga

## Body Awareness is Key

One of the most important aspects of yoga is developing awareness of your body. This means:

### Listen to Your Body
- Every body is different and unique
- What feels good for others might not work for you
- Pain is never the goal in yoga
- Discomfort vs pain: learn the difference

### Breathing and Movement
- Your breath guides your practice
- Move with your breath, not against it
- If you can't breathe comfortably, ease up
- Breath is your best teacher

### Modifications Are Your Friend
- Every pose can be modified
- Props can help you find comfort
- There's no "perfect" pose
- Progress is personal

## Building Your Foundation

### Start Slow
Begin with basic poses and simple movements. Build strength and flexibility gradually.

### Consistency Over Intensity
A short daily practice is better than an intense weekly session.

### Be Patient
Flexibility and strength take time to develop. Enjoy the journey!

Remember: Yoga is not about perfection—it's about connection with yourself.`,
      estimatedReadTime: 15,
    },
  });

  // Lesson 3 - Video
  const lesson3 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module1.id,
      title: "Basic Breathing Techniques",
      slug: "basic-breathing-techniques",
      type: "video",
      description: "Learn foundational breathing exercises for your practice",
      sequence: 3,
      duration: 12,
      isFree: false,
      status: "published",
    },
  });
  course1Lessons.push(lesson3);

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson3.id,
      textContent:
        "<p>Master essential breathing techniques that form the foundation of yoga practice. We'll explore:</p><ul><li>Deep abdominal breathing</li><li>Ujjayi (ocean) breath</li><li>Breath awareness during movement</li><li>Using breath for relaxation</li></ul>",
    },
  });

  // Additional lessons for other modules
  const lesson4 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module2.id,
      title: "Gentle Morning Stretches",
      slug: "gentle-morning-stretches",
      type: "video",
      description: "Start your day with gentle stretches to awaken your body",
      sequence: 1,
      duration: 20,
      isFree: false,
      status: "published",
    },
  });
  course1Lessons.push(lesson4);

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson4.id,
      textContent:
        "<p>Begin your day with this gentle 20-minute routine designed to wake up your body and mind.</p>",
    },
  });

  // Bonus lesson
  const lesson5 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: null, // Direct lesson
      title: "Bonus: Relaxation & Meditation",
      slug: "relaxation-meditation",
      type: "video",
      description: "A calming meditation practice to end your yoga sessions",
      sequence: 100,
      duration: 15,
      isFree: false,
      status: "published",
    },
  });
  course1Lessons.push(lesson5);

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson5.id,
      textContent:
        "<p>End your practice with this peaceful meditation to integrate your yoga experience.</p>",
    },
  });

  console.log(`✅ Created ${course1Lessons.length} lessons for Course 1`);

  // 7. Create Modules and Lessons for Course 2 (Strength Training)
  console.log("📖 Creating modules and lessons for Course 2...");

  const course2Module1 = await prisma.module.create({
    data: {
      courseId: courses[1].id,
      title: "Strength Training Basics",
      slug: "strength-training-basics",
      description: "Learn the fundamentals of safe and effective strength training",
      sequence: 1,
      duration: 120,
      status: "published",
    },
  });

  const course2Module2 = await prisma.module.create({
    data: {
      courseId: courses[1].id,
      title: "Building Your Routine",
      slug: "building-your-routine",
      description: "Create a sustainable strength training routine that fits your lifestyle",
      sequence: 2,
      duration: 120,
      status: "published",
    },
  });

  // Create lessons for Course 2
  const course2Lessons = await Promise.all([
    prisma.lesson.create({
      data: {
        courseId: courses[1].id,
        moduleId: course2Module1.id,
        title: "Getting Started with Strength Training",
        slug: "getting-started-strength-training",
        type: "video",
        description: "Learn the basics and overcome intimidation",
        sequence: 1,
        duration: 15,
        isFree: true,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[1].id,
        moduleId: course2Module1.id,
        title: "Proper Form and Technique",
        slug: "proper-form-technique",
        type: "video",
        description: "Master the fundamentals of safe lifting",
        sequence: 2,
        duration: 20,
        isFree: false,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[1].id,
        moduleId: course2Module2.id,
        title: "Your First Workout Plan",
        slug: "first-workout-plan",
        type: "video",
        description: "Step-by-step guide to your first strength workout",
        sequence: 1,
        duration: 25,
        isFree: false,
        status: "published",
      },
    }),
  ]);

  // Create lesson descriptions for Course 2
  for (const lesson of course2Lessons) {
    await prisma.lessonDescription.create({
      data: {
        lessonId: lesson.id,
        textContent: "<p>This lesson provides essential techniques for building strength safely and effectively.</p>",
      },
    });
  }

  console.log(`✅ Created ${course2Lessons.length} lessons for Course 2`);

  // 8. Create Modules and Lessons for Course 3 (Healthy Cooking)
  console.log("📖 Creating modules and lessons for Course 3...");

  const course3Module1 = await prisma.module.create({
    data: {
      courseId: courses[2].id,
      title: "Cooking Fundamentals",
      slug: "cooking-fundamentals",
      description: "Essential skills and techniques for healthy cooking",
      sequence: 1,
      duration: 90,
      status: "published",
    },
  });

  const course3Lessons = await Promise.all([
    prisma.lesson.create({
      data: {
        courseId: courses[2].id,
        moduleId: course3Module1.id,
        title: "Kitchen Essentials & Setup",
        slug: "kitchen-essentials-setup",
        type: "video",
        description: "Setting up your kitchen for healthy cooking success",
        sequence: 1,
        duration: 15,
        isFree: true,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[2].id,
        moduleId: course3Module1.id,
        title: "Nutrition Basics for Cooking",
        slug: "nutrition-basics-cooking",
        type: "text",
        description: "Understanding macronutrients and micronutrients in cooking",
        sequence: 2,
        duration: 20,
        isFree: false,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[2].id,
        moduleId: course3Module1.id,
        title: "Meal Prep Masterclass",
        slug: "meal-prep-masterclass",
        type: "video",
        description: "Learn to meal prep like a pro for busy weeks",
        sequence: 3,
        duration: 30,
        isFree: false,
        status: "published",
      },
    }),
  ]);

  await prisma.lessonDescription.create({
    data: {
      lessonId: course3Lessons[0].id,
      textContent: "<p>Learn how to set up your kitchen for cooking success with the right tools and ingredients.</p>",
    },
  });

  await prisma.textLesson.create({
    data: {
      lessonId: course3Lessons[1].id,
      content: `# Nutrition Basics for Healthy Cooking

## Understanding Macronutrients

### Proteins
- **Function:** Build and repair tissues, support immune function
- **Sources:** Lean meats, fish, eggs, legumes, tofu, quinoa
- **Cooking Tips:** Don't overcook to preserve nutrients

### Carbohydrates
- **Function:** Primary energy source for the body
- **Choose:** Complex carbs like whole grains, vegetables, fruits
- **Cooking Tips:** Steam or roast vegetables to retain nutrients

### Healthy Fats
- **Function:** Support hormone production, vitamin absorption
- **Sources:** Avocados, nuts, seeds, olive oil, fatty fish
- **Cooking Tips:** Add healthy fats after cooking to preserve benefits

## Essential Micronutrients

### Vitamins
- **Water-soluble:** B vitamins, Vitamin C (cook lightly to preserve)
- **Fat-soluble:** A, D, E, K (cook with healthy fats for absorption)

### Minerals
- **Iron:** Enhance absorption with Vitamin C
- **Calcium:** Combine with Vitamin D sources
- **Magnesium:** Found in leafy greens and nuts

## Cooking Methods That Preserve Nutrients

1. **Steaming:** Retains most vitamins and minerals
2. **Roasting:** Concentrates flavors without adding fats
3. **Sautéing:** Quick cooking preserves nutrients
4. **Raw preparations:** Maximum nutrient retention

Remember: Variety is key to getting all essential nutrients!`,
      estimatedReadTime: 20,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: course3Lessons[2].id,
      textContent: "<p>Master the art of meal preparation to save time and eat healthier throughout the week.</p>",
    },
  });

  console.log(`✅ Created ${course3Lessons.length} lessons for Course 3`);

  // 9. Create Modules and Lessons for Course 4 (Confidence Building)
  console.log("📖 Creating modules and lessons for Course 4...");

  const course4Module1 = await prisma.module.create({
    data: {
      courseId: courses[3].id,
      title: "Confidence Foundations",
      slug: "confidence-foundations",
      description: "Building the foundation of unshakeable confidence",
      sequence: 1,
      duration: 90,
      status: "published",
    },
  });

  const course4Lessons = await Promise.all([
    prisma.lesson.create({
      data: {
        courseId: courses[3].id,
        moduleId: course4Module1.id,
        title: "Understanding Confidence",
        slug: "understanding-confidence",
        type: "video",
        description: "What confidence really is and how to build it",
        sequence: 1,
        duration: 18,
        isFree: true,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[3].id,
        moduleId: course4Module1.id,
        title: "Overcoming Limiting Beliefs",
        slug: "overcoming-limiting-beliefs",
        type: "text",
        description: "Identify and transform beliefs that hold you back",
        sequence: 2,
        duration: 15,
        isFree: false,
        status: "published",
      },
    }),
  ]);

  await prisma.lessonDescription.create({
    data: {
      lessonId: course4Lessons[0].id,
      textContent: "<p>Discover what true confidence means and learn practical steps to build it in your daily life.</p>",
    },
  });

  await prisma.textLesson.create({
    data: {
      lessonId: course4Lessons[1].id,
      content: `# Overcoming Limiting Beliefs

## What Are Limiting Beliefs?

Limiting beliefs are thoughts or convictions that constrain us in some way. They're often unconscious and formed early in life.

### Common Limiting Beliefs About Confidence

- "I'm not good enough"
- "I don't deserve success"
- "People will judge me if I speak up"
- "I'm too shy/quiet/awkward"
- "I need to be perfect to be worthy"

## How Limiting Beliefs Form

### Early Experiences
- Childhood comments from parents, teachers, peers
- Comparison with siblings or classmates
- Traumatic or embarrassing experiences

### Societal Messages
- Media representations
- Cultural expectations
- Gender stereotypes

## Steps to Transform Limiting Beliefs

### 1. Identify Your Beliefs
Write down thoughts that come up when you feel unconfident. What story are you telling yourself?

### 2. Question the Evidence
- Is this belief absolutely true?
- What evidence supports it? What contradicts it?
- Would I say this to a dear friend?

### 3. Reframe with Empowering Beliefs
- "I am learning and growing every day"
- "My voice and opinions matter"
- "I am worthy exactly as I am"
- "Mistakes are opportunities to learn"

### 4. Take Small Actions
Choose one small action that contradicts your limiting belief and practice it regularly.

### 5. Celebrate Progress
Acknowledge every step forward, no matter how small.

## Affirmations for Confidence

- "I trust myself and my abilities"
- "I am becoming more confident every day"
- "My unique perspective has value"
- "I choose courage over comfort"

Remember: Transforming beliefs takes time and patience. Be kind to yourself in this process.`,
      estimatedReadTime: 15,
    },
  });

  console.log(`✅ Created ${course4Lessons.length} lessons for Course 4`);

  // 10. Create Course Reviews
  console.log("⭐ Creating course reviews...");
  const reviews = await Promise.all([
    // Reviews for Course 1 (Beginner Yoga)
    prisma.courseReview.create({
      data: {
        courseId: courses[0].id,
        userId: users[4].id, // Neha Gupta
        rating: 5,
        review:
          "Perfect introduction to yoga! Priya's teaching style is so clear and encouraging. I went from being completely intimidated by yoga to practicing every day. The progression is just right for beginners.",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[0].id,
        userId: users[5].id, // Ritu Singh
        rating: 5,
        review:
          "यह course बहुत अच्छा है। हर pose को बहुत अच्छे से explain किया गया है। अब मैं confident feel करती हूं yoga करते समय।",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[0].id,
        userId: users[6].id, // Kavita Reddy
        rating: 4,
        review:
          "Great course for beginners! Love the breathing techniques. I feel more flexible and relaxed. Would love to see more advanced sequences as a follow-up course.",
      },
    }),

    // Reviews for Course 2 (Strength Training)
    prisma.courseReview.create({
      data: {
        courseId: courses[1].id,
        userId: users[4].id,
        rating: 5,
        review:
          "This course completely changed my relationship with strength training! Priya made it so approachable and non-intimidating. I'm actually excited to go to the gym now!",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[1].id,
        userId: users[5].id,
        rating: 5,
        review:
          "मुझे लगता था कि strength training सिर्फ men के लिए है। लेकिन यह course ने मेरी सोच बदल दी। अब मैं confident हूं gym में।",
      },
    }),

    // Reviews for Course 3 (Healthy Cooking)
    prisma.courseReview.create({
      data: {
        courseId: courses[2].id,
        userId: users[4].id,
        rating: 4,
        review:
          "Really practical course! Anjali's recipes are simple but delicious. The meal prep tips save me so much time. My family loves the healthy meals I'm making now.",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[2].id,
        userId: users[6].id,
        rating: 5,
        review:
          "As someone who lived on takeout, this course was a game-changer! I can actually cook healthy, tasty meals now. The nutrition information is so helpful too.",
      },
    }),

    // Reviews for Course 4 (Confidence Building)
    prisma.courseReview.create({
      data: {
        courseId: courses[3].id,
        userId: users[5].id,
        rating: 5,
        review:
          "यह course ने मुझमें confidence लाया है। Meera के techniques really work करते हैं। अब मैं meetings में बात करने से डरती नहीं।",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[3].id,
        userId: users[6].id,
        rating: 5,
        review:
          "Incredible transformation! I used to second-guess everything I said. Meera's practical exercises helped me build genuine confidence. Highly recommend!",
      },
    }),
  ]);

  console.log(`✅ Created ${reviews.length} course reviews`);

  // 11. Create User Progress
  console.log("📊 Creating user progress records...");

  // Course progress
  const courseProgress = await Promise.all([
    prisma.userCourseProgress.create({
      data: {
        userId: users[3].id,
        courseId: courses[0].id,
        progress: 100,
        isCompleted: true,
        completedAt: new Date(),
        lastLessonId: course1Lessons[4].id,
        metadata: {
          totalLessons: 5,
          completedLessons: 5,
        },
      },
    }),
    prisma.userCourseProgress.create({
      data: {
        userId: users[4].id,
        courseId: courses[0].id,
        progress: 60,
        isCompleted: false,
        lastLessonId: course1Lessons[2].id,
        metadata: {
          totalLessons: 5,
          completedLessons: 3,
        },
      },
    }),
    prisma.userCourseProgress.create({
      data: {
        userId: users[5].id,
        courseId: courses[2].id,
        progress: 33,
        isCompleted: false,
        lastLessonId: course3Lessons[0].id,
        metadata: {
          totalLessons: 3,
          completedLessons: 1,
        },
      },
    }),
  ]);

  // Lesson progress
  const lessonProgress = await Promise.all([
    prisma.userLessonProgress.create({
      data: {
        userId: users[3].id,
        lessonId: course1Lessons[0].id,
        isCompleted: true,
        completedAt: new Date(),
        currentTimestamp: 720,
      },
    }),
    prisma.userLessonProgress.create({
      data: {
        userId: users[4].id,
        lessonId: course1Lessons[0].id,
        isCompleted: true,
        completedAt: new Date(),
        currentTimestamp: 720,
      },
    }),
    prisma.userLessonProgress.create({
      data: {
        userId: users[4].id,
        lessonId: course1Lessons[1].id,
        isCompleted: false,
        currentTimestamp: 450,
      },
    }),
  ]);

  console.log(
    `✅ Created ${courseProgress.length} course progress and ${lessonProgress.length} lesson progress records`
  );

  // Summary
  console.log("\n🎉 Database seeding completed successfully!\n");
  console.log("📊 Summary:");
  console.log(`   👤 Users: ${users.length}`);
  console.log(`   🎓 Trainers: ${trainers.length}`);
  console.log(`   📁 Categories: ${parentCategories.length + subCategories.length}`);
  console.log(`   🎬 Videos: ${videos.length} (empty as requested)`);
  console.log(`   📚 Courses: ${courses.length}`);
  console.log(`   📖 Modules: 7`);
  console.log(`   📄 Lessons: ${
      course1Lessons.length + course2Lessons.length + course3Lessons.length + course4Lessons.length
    }`);
  console.log(`   ⭐ Reviews: ${reviews.length}`);
  console.log(`   📊 Progress Records: ${courseProgress.length + lessonProgress.length}`);
  console.log("\n📚 Course Topics:");
  console.log("   🧘‍♀️ Yoga for Beginners: Complete Foundation");
  console.log("   💪 Women's Strength Training Program");
  console.log("   🍳 Healthy Cooking Mastery");
  console.log("   ✨ Build Unshakeable Confidence");
  console.log("\n✅ Ready for testing!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
