import "dotenv/config";
import { prisma } from "@/lib/db";

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  // await prisma.courseReview.deleteMany();
  // await prisma.userLessonProgress.deleteMany();
  // await prisma.userCourseProgress.deleteMany();
  // await prisma.lessonAttachment.deleteMany();
  // await prisma.lessonDescription.deleteMany();
  // await prisma.textLesson.deleteMany();
  // await prisma.videoLesson.deleteMany();
  // await prisma.lesson.deleteMany();
  // await prisma.module.deleteMany();
  // await prisma.course.deleteMany();
  // await prisma.video.deleteMany();
  // await prisma.trainer.deleteMany();
  // await prisma.category.deleteMany();
  // await prisma.session.deleteMany();
  // await prisma.user.deleteMany();

  // Shared video data (since we only have one video)
  const videoData = {
    storageKey: "videos/sample-lesson.mp4",
    thumbnailUrl: "https://example.com/thumbnails/sample-lesson.jpg",
    playbackUrl: "https://example.com/videos/sample-lesson.mp4",
    duration: 720, // 12 minutes
    status: "ready",
    metadata: {
      resolution: "1920x1080",
      bitrate: "5000",
      codec: "h264",
      format: "mp4",
    },
  };

  // 1. Create Users
  console.log("👤 Creating users...");
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@pankhuri.com",
        phone: "+919876543210",
        displayName: "Admin User",
        profileImage: "https://i.pravatar.cc/150?img=1",
        dateOfBirth: new Date("1990-01-15"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "admin",
        status: "active",
      },
    }),
    prisma.user.create({
      data: {
        email: "trainer1@pankhuri.com",
        phone: "+919876543211",
        displayName: "Dr. Priya Sharma",
        profileImage: "https://i.pravatar.cc/150?img=5",
        dateOfBirth: new Date("1985-03-20"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
      },
    }),
    prisma.user.create({
      data: {
        email: "trainer2@pankhuri.com",
        phone: "+919876543212",
        displayName: "Anjali Mehta",
        profileImage: "https://i.pravatar.cc/150?img=9",
        dateOfBirth: new Date("1988-07-10"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "hi",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
      },
    }),
    prisma.user.create({
      data: {
        email: "student1@example.com",
        phone: "+919876543213",
        displayName: "Neha Gupta",
        profileImage: "https://i.pravatar.cc/150?img=10",
        dateOfBirth: new Date("1995-05-15"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: true,
        isPhoneVerified: true,
        role: "user",
        status: "active",
      },
    }),
    prisma.user.create({
      data: {
        email: "student2@example.com",
        phone: "+919876543214",
        displayName: "Ritu Singh",
        profileImage: "https://i.pravatar.cc/150?img=20",
        dateOfBirth: new Date("1992-11-25"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "hi",
        isEmailVerified: true,
        isPhoneVerified: false,
        role: "user",
        status: "active",
      },
    }),
    prisma.user.create({
      data: {
        email: "student3@example.com",
        phone: "+919876543215",
        displayName: "Kavita Reddy",
        profileImage: "https://i.pravatar.cc/150?img=25",
        dateOfBirth: new Date("1998-02-28"),
        gender: "female",
        countryCode: "IN",
        languagePreference: "en",
        isEmailVerified: false,
        isPhoneVerified: true,
        role: "user",
        status: "active",
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // 2. Create Trainers
  console.log("🎓 Creating trainers...");
  const trainers = await Promise.all([
    prisma.trainer.create({
      data: {
        userId: users[1].id, // Dr. Priya Sharma
        bio: "Certified yoga instructor with over 15 years of experience. Specializes in prenatal and postnatal yoga, helping women through their motherhood journey with holistic wellness practices.",
        specialization: ["Prenatal Yoga", "Postnatal Yoga", "Meditation", "Breathing Techniques"],
        experience: 15,
        rating: 4.8,
        totalStudents: 2500,
        socialLinks: {
          linkedin: "https://linkedin.com/in/priya-sharma",
          instagram: "https://instagram.com/priya.yoga",
          website: "https://priyayoga.com",
        },
        status: "active",
      },
    }),
    prisma.trainer.create({
      data: {
        userId: users[2].id, // Anjali Mehta
        bio: "Nutritionist and wellness coach specializing in maternal health and child nutrition. Passionate about helping mothers make informed dietary choices for themselves and their families.",
        specialization: ["Nutrition", "Meal Planning", "Child Nutrition", "Wellness Coaching"],
        experience: 10,
        rating: 4.9,
        totalStudents: 1800,
        socialLinks: {
          instagram: "https://instagram.com/anjali.nutrition",
          facebook: "https://facebook.com/anjalimehta.nutrition",
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
        name: "Yoga & Fitness",
        slug: "yoga-fitness",
        description:
          "Yoga, exercise, and fitness programs for prenatal, postnatal, and general wellness",
        icon: "🧘‍♀️",
        status: "active",
        sequence: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: "Nutrition & Diet",
        slug: "nutrition-diet",
        description:
          "Nutrition guidance, meal planning, and dietary advice for mothers and families",
        icon: "🥗",
        status: "active",
        sequence: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: "Mental Wellness",
        slug: "mental-wellness",
        description: "Mental health, meditation, stress management, and emotional well-being",
        icon: "🧠",
        status: "active",
        sequence: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: "Parenting",
        slug: "parenting",
        description: "Parenting tips, child development, and family care guidance",
        icon: "👶",
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
        name: "Prenatal Yoga",
        slug: "prenatal-yoga",
        description: "Yoga practices specifically designed for pregnancy",
        icon: "🤰",
        status: "active",
        sequence: 1,
      },
    }),
    prisma.category.create({
      data: {
        parentId: parentCategories[0].id,
        name: "Postnatal Yoga",
        slug: "postnatal-yoga",
        description: "Yoga for recovery and strength after childbirth",
        icon: "🤱",
        status: "active",
        sequence: 2,
      },
    }),
    prisma.category.create({
      data: {
        parentId: parentCategories[1].id,
        name: "Pregnancy Nutrition",
        slug: "pregnancy-nutrition",
        description: "Nutritional guidance during pregnancy",
        icon: "🍎",
        status: "active",
        sequence: 1,
      },
    }),
    prisma.category.create({
      data: {
        parentId: parentCategories[1].id,
        name: "Lactation & Breastfeeding",
        slug: "lactation-breastfeeding",
        description: "Nutrition for breastfeeding mothers",
        icon: "🍼",
        status: "active",
        sequence: 2,
      },
    }),
  ]);

  console.log(
    `✅ Created ${parentCategories.length} parent categories and ${subCategories.length} subcategories`
  );

  // 4. Create Videos
  console.log("🎬 Creating videos...");
  const videos = await Promise.all([
    prisma.video.create({
      data: {
        title: "Introduction to Prenatal Yoga",
        ...videoData,
      },
    }),
    prisma.video.create({
      data: {
        title: "Breathing Techniques for Labor",
        ...videoData,
      },
    }),
    prisma.video.create({
      data: {
        title: "Gentle Stretching Exercises",
        ...videoData,
      },
    }),
    prisma.video.create({
      data: {
        title: "Nutrition Basics Demo",
        ...videoData,
      },
    }),
    prisma.video.create({
      data: {
        title: "Course Demo Video",
        ...videoData,
      },
    }),
  ]);

  console.log(`✅ Created ${videos.length} videos`);

  // 5. Create Courses
  console.log("📚 Creating courses...");
  const courses = await Promise.all([
    prisma.course.create({
      data: {
        categoryId: subCategories[0].id, // Prenatal Yoga
        trainerId: trainers[0].id,
        demoVideoId: videos[4].id,
        title: "Complete Prenatal Yoga Program",
        slug: "complete-prenatal-yoga-program",
        description:
          "A comprehensive yoga program designed specifically for expecting mothers. Learn safe and effective yoga practices to support your pregnancy journey, improve flexibility, reduce stress, and prepare your body for childbirth.",
        thumbnailImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800",
        coverImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200",
        level: "beginner",
        duration: 480, // 8 hours
        language: "en",
        status: "active",
        hasCertificate: true,
        rating: 4.8,
        averageRating: 4.8,
        totalReviews: 125,
        tags: ["pregnancy", "yoga", "prenatal", "wellness", "flexibility"],
        metadata: {
          prerequisites: [],
          targetAudience: "Pregnant women in any trimester",
          whatYouWillLearn: [
            "Safe yoga poses for pregnancy",
            "Breathing techniques for labor",
            "Stress reduction and relaxation",
            "Pelvic floor exercises",
            "Preparation for childbirth",
          ],
        },
      },
    }),
    prisma.course.create({
      data: {
        categoryId: subCategories[1].id, // Postnatal Yoga
        trainerId: trainers[0].id,
        demoVideoId: videos[4].id,
        title: "Postnatal Recovery & Strength",
        slug: "postnatal-recovery-strength",
        description:
          "Rebuild your strength and restore your body after childbirth with this specially designed postnatal yoga program. Focus on core recovery, pelvic floor strengthening, and gentle exercises safe for new mothers.",
        thumbnailImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800",
        coverImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200",
        level: "beginner",
        duration: 360, // 6 hours
        language: "en",
        status: "active",
        hasCertificate: true,
        rating: 4.9,
        averageRating: 4.9,
        totalReviews: 89,
        tags: ["postnatal", "yoga", "recovery", "strength", "new-mom"],
        metadata: {
          prerequisites: ["Minimum 6 weeks postpartum or cleared by doctor"],
          targetAudience: "New mothers post-childbirth",
          whatYouWillLearn: [
            "Core strengthening exercises",
            "Pelvic floor rehabilitation",
            "Gentle stretching routines",
            "Energy restoration techniques",
            "Managing diastasis recti",
          ],
        },
      },
    }),
    prisma.course.create({
      data: {
        categoryId: subCategories[2].id, // Pregnancy Nutrition
        trainerId: trainers[1].id,
        demoVideoId: videos[4].id,
        title: "Nutrition for a Healthy Pregnancy",
        slug: "nutrition-healthy-pregnancy",
        description:
          "Learn everything you need to know about nutrition during pregnancy. Discover the right foods, supplements, and meal plans to support your baby's development and your own health throughout pregnancy.",
        thumbnailImage: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
        coverImage: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200",
        level: "beginner",
        duration: 240, // 4 hours
        language: "en",
        status: "active",
        hasCertificate: true,
        rating: 4.7,
        averageRating: 4.7,
        totalReviews: 156,
        tags: ["nutrition", "pregnancy", "diet", "health", "meal-planning"],
        metadata: {
          prerequisites: [],
          targetAudience: "Expecting mothers and women planning pregnancy",
          whatYouWillLearn: [
            "Essential nutrients for pregnancy",
            "Meal planning and preparation",
            "Managing pregnancy symptoms through diet",
            "Safe foods and foods to avoid",
            "Healthy weight gain guidelines",
          ],
        },
      },
    }),
    prisma.course.create({
      data: {
        categoryId: subCategories[3].id, // Lactation & Breastfeeding
        trainerId: trainers[1].id,
        demoVideoId: videos[4].id,
        title: "Breastfeeding & Lactation Nutrition",
        slug: "breastfeeding-lactation-nutrition",
        description:
          "Optimize your nutrition for successful breastfeeding. Learn about foods that support milk production, nutritional needs during lactation, and how to maintain your health while nursing.",
        thumbnailImage: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800",
        coverImage: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200",
        level: "beginner",
        duration: 180, // 3 hours
        language: "hi",
        status: "active",
        hasCertificate: false,
        rating: 4.8,
        averageRating: 4.8,
        totalReviews: 92,
        tags: ["breastfeeding", "lactation", "nutrition", "new-mom", "infant-care"],
        metadata: {
          prerequisites: [],
          targetAudience: "Breastfeeding mothers and pregnant women",
          whatYouWillLearn: [
            "Foods for milk production",
            "Nutritional requirements while nursing",
            "Managing common breastfeeding issues",
            "Hydration and supplements",
            "Balancing diet and baby's needs",
          ],
        },
      },
    }),
  ]);

  console.log(`✅ Created ${courses.length} courses`);

  // 6. Create Modules and Lessons for Course 1 (Prenatal Yoga)
  console.log("📖 Creating modules and lessons for Course 1...");

  const course1Module1 = await prisma.module.create({
    data: {
      courseId: courses[0].id,
      title: "Getting Started with Prenatal Yoga",
      slug: "getting-started",
      description:
        "Introduction to prenatal yoga, understanding the benefits, and learning the basics",
      sequence: 1,
      duration: 120,
      status: "published",
      metadata: {
        learningObjectives: [
          "Understand benefits of prenatal yoga",
          "Learn safety guidelines",
          "Master basic poses",
        ],
      },
    },
  });

  const course1Module2 = await prisma.module.create({
    data: {
      courseId: courses[0].id,
      title: "First Trimester Practices",
      slug: "first-trimester",
      description: "Gentle yoga practices safe for the first trimester of pregnancy",
      sequence: 2,
      duration: 180,
      status: "published",
      metadata: {
        learningObjectives: [
          "Safe exercises for first trimester",
          "Managing morning sickness",
          "Building foundation",
        ],
      },
    },
  });

  const course1Module3 = await prisma.module.create({
    data: {
      courseId: courses[0].id,
      title: "Second & Third Trimester",
      slug: "second-third-trimester",
      description: "Advanced practices as your pregnancy progresses",
      sequence: 3,
      duration: 180,
      status: "published",
      metadata: {
        learningObjectives: [
          "Adapt poses for growing belly",
          "Prepare for labor",
          "Maintain strength and flexibility",
        ],
      },
    },
  });

  // Create lessons for Module 1
  const course1Lessons = [];

  // Lesson 1 - Video
  const lesson1 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module1.id,
      title: "Welcome to Prenatal Yoga",
      slug: "welcome-to-prenatal-yoga",
      type: "video",
      description: "An introduction to the course and what you can expect",
      sequence: 1,
      duration: 12,
      isFree: true,
      status: "published",
      metadata: {
        difficulty: "easy",
      },
    },
  });
  course1Lessons.push(lesson1);

  await prisma.videoLesson.create({
    data: {
      lessonId: lesson1.id,
      videoId: videos[0].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson1.id,
      textContent:
        "<p>Welcome to the Complete Prenatal Yoga Program! In this introductory lesson, we'll cover:</p><ul><li>What to expect from this course</li><li>The benefits of prenatal yoga</li><li>Safety guidelines and precautions</li><li>How to set up your practice space</li></ul><p>Remember to always listen to your body and consult with your healthcare provider before starting any new exercise program.</p>",
    },
  });

  await prisma.lessonAttachment.create({
    data: {
      lessonId: lesson1.id,
      title: "Course Welcome Guide",
      fileUrl: "https://example.com/attachments/course-welcome-guide.pdf",
      fileName: "course-welcome-guide.pdf",
      fileSize: 524288, // 512 KB
      mimeType: "application/pdf",
      type: "pdf",
      sequence: 1,
    },
  });

  // Lesson 2 - Text
  const lesson2 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module1.id,
      title: "Understanding Your Changing Body",
      slug: "understanding-changing-body",
      type: "text",
      description: "Learn about the physical changes during pregnancy",
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
      content: `# Understanding Your Changing Body

## Physical Changes During Pregnancy

Pregnancy brings remarkable changes to your body. Understanding these changes will help you adapt your yoga practice safely and effectively.

### First Trimester Changes
- Hormonal shifts causing fatigue and nausea
- Breast tenderness and enlargement
- Increased blood volume
- Subtle changes in balance

### Second Trimester Changes
- Growing belly and shift in center of gravity
- Loosening of ligaments due to relaxin hormone
- Increased energy levels
- Back pain may begin

### Third Trimester Changes
- Significant weight in the front affecting posture
- Shortness of breath as baby pushes on diaphragm
- Swelling in feet and ankles
- Preparation for labor

## How Yoga Helps

Prenatal yoga is specifically designed to:
- Strengthen muscles that support pregnancy
- Improve flexibility and prepare for childbirth
- Reduce stress and promote relaxation
- Connect with your baby
- Build community with other expecting mothers

## Safety First

Always remember:
- Avoid lying flat on your back after the first trimester
- Don't overstretch - your ligaments are looser
- Stay hydrated
- Stop if you feel dizzy, short of breath, or experience pain
- Modify poses as your body changes

Your journey is unique. Honor your body and its wisdom.`,
      estimatedReadTime: 15,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson2.id,
      textContent:
        "<p>This comprehensive guide covers the physical changes you'll experience during pregnancy and how yoga can support you through each stage.</p>",
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
      description: "Learn foundational breathing exercises for pregnancy",
      sequence: 3,
      duration: 12,
      isFree: false,
      status: "published",
    },
  });
  course1Lessons.push(lesson3);

  await prisma.videoLesson.create({
    data: {
      lessonId: lesson3.id,
      videoId: videos[1].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson3.id,
      textContent:
        "<p>Master essential breathing techniques that will help you throughout pregnancy and during labor. We'll practice:</p><ul><li>Ujjayi (Ocean) Breath</li><li>Alternate Nostril Breathing</li><li>Deep Belly Breathing</li><li>Calming Breath for stress relief</li></ul>",
    },
  });

  await Promise.all([
    prisma.lessonAttachment.create({
      data: {
        lessonId: lesson3.id,
        title: "Breathing Exercise Chart",
        fileUrl: "https://example.com/attachments/breathing-chart.pdf",
        fileName: "breathing-chart.pdf",
        fileSize: 327680, // 320 KB
        mimeType: "application/pdf",
        type: "pdf",
        sequence: 1,
      },
    }),
    prisma.lessonAttachment.create({
      data: {
        lessonId: lesson3.id,
        title: "Audio Guide - Breathing Practice",
        fileUrl: "https://example.com/attachments/breathing-audio.mp3",
        fileName: "breathing-audio.mp3",
        fileSize: 2097152, // 2 MB
        mimeType: "audio/mpeg",
        type: "other",
        sequence: 2,
      },
    }),
  ]);

  // Lesson 4 - Video (Module 2)
  const lesson4 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: course1Module2.id,
      title: "Gentle Morning Flow",
      slug: "gentle-morning-flow",
      type: "video",
      description: "A gentle yoga sequence perfect for first trimester mornings",
      sequence: 1,
      duration: 12,
      isFree: false,
      status: "published",
    },
  });
  course1Lessons.push(lesson4);

  await prisma.videoLesson.create({
    data: {
      lessonId: lesson4.id,
      videoId: videos[2].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson4.id,
      textContent:
        "<p>Start your day with this gentle 12-minute flow designed for the first trimester. This sequence helps with energy, reduces nausea, and prepares you for the day ahead.</p>",
    },
  });

  // Lesson 5 - Direct lesson (not in module)
  const lesson5 = await prisma.lesson.create({
    data: {
      courseId: courses[0].id,
      moduleId: null, // Direct lesson
      title: "Bonus: Meditation for Expecting Mothers",
      slug: "meditation-expecting-mothers",
      type: "video",
      description: "A calming meditation practice to connect with your baby",
      sequence: 100, // High sequence number for bonus content
      duration: 12,
      isFree: false,
      status: "published",
    },
  });
  course1Lessons.push(lesson5);

  await prisma.videoLesson.create({
    data: {
      lessonId: lesson5.id,
      videoId: videos[0].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: lesson5.id,
      textContent:
        "<p>Take time to connect with your baby through this guided meditation. Perfect for any time of day when you need to relax and bond.</p>",
    },
  });

  console.log(`✅ Created ${course1Lessons.length} lessons for Course 1`);

  // 7. Create Modules and Lessons for Course 2 (Postnatal)
  console.log("📖 Creating modules and lessons for Course 2...");

  const course2Module1 = await prisma.module.create({
    data: {
      courseId: courses[1].id,
      title: "Foundation & Recovery",
      slug: "foundation-recovery",
      description: "Gentle exercises to begin your postnatal recovery journey",
      sequence: 1,
      duration: 120,
      status: "published",
    },
  });

  const course2Module2 = await prisma.module.create({
    data: {
      courseId: courses[1].id,
      title: "Core & Pelvic Floor",
      slug: "core-pelvic-floor",
      description: "Rebuilding core strength and pelvic floor health",
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
        title: "Getting Started Safely",
        slug: "getting-started-safely",
        type: "video",
        description: "Learn when and how to start exercising after childbirth",
        sequence: 1,
        duration: 12,
        isFree: true,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[1].id,
        moduleId: course2Module1.id,
        title: "Gentle Stretching Routine",
        slug: "gentle-stretching-routine",
        type: "video",
        description: "Easy stretches to release tension and improve flexibility",
        sequence: 2,
        duration: 12,
        isFree: false,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[1].id,
        moduleId: course2Module2.id,
        title: "Pelvic Floor Exercises",
        slug: "pelvic-floor-exercises",
        type: "video",
        description: "Essential exercises for pelvic floor recovery",
        sequence: 1,
        duration: 12,
        isFree: false,
        status: "published",
      },
    }),
  ]);

  // Create video lessons for Course 2
  for (const lesson of course2Lessons) {
    await prisma.videoLesson.create({
      data: {
        lessonId: lesson.id,
        videoId: videos[0].id,
      },
    });

    await prisma.lessonDescription.create({
      data: {
        lessonId: lesson.id,
        textContent:
          "<p>This lesson provides essential techniques for your postnatal recovery journey.</p>",
      },
    });
  }

  console.log(`✅ Created ${course2Lessons.length} lessons for Course 2`);

  // 8. Create Modules and Lessons for Course 3 (Pregnancy Nutrition)
  console.log("📖 Creating modules and lessons for Course 3...");

  const course3Module1 = await prisma.module.create({
    data: {
      courseId: courses[2].id,
      title: "Nutrition Fundamentals",
      slug: "nutrition-fundamentals",
      description: "Essential nutrients and dietary guidelines for pregnancy",
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
        title: "Introduction to Pregnancy Nutrition",
        slug: "intro-pregnancy-nutrition",
        type: "video",
        description: "Overview of nutritional needs during pregnancy",
        sequence: 1,
        duration: 12,
        isFree: true,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[2].id,
        moduleId: course3Module1.id,
        title: "Essential Nutrients Guide",
        slug: "essential-nutrients-guide",
        type: "text",
        description: "Detailed guide on vitamins, minerals, and macronutrients",
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
        title: "Meal Planning Workshop",
        slug: "meal-planning-workshop",
        type: "video",
        description: "Learn to create balanced meal plans for pregnancy",
        sequence: 3,
        duration: 12,
        isFree: false,
        status: "published",
      },
    }),
  ]);

  // Create lesson content for Course 3
  await prisma.videoLesson.create({
    data: {
      lessonId: course3Lessons[0].id,
      videoId: videos[3].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: course3Lessons[0].id,
      textContent:
        "<p>Learn about the key nutrients you need during pregnancy and why they're important for you and your baby.</p>",
    },
  });

  await prisma.textLesson.create({
    data: {
      lessonId: course3Lessons[1].id,
      content: `# Essential Nutrients for Pregnancy

## Macronutrients

### Protein
- **Daily Need:** 75-100g
- **Sources:** Lean meats, eggs, dairy, legumes, nuts
- **Benefits:** Supports baby's growth and maternal tissue expansion

### Carbohydrates
- **Daily Need:** 175-210g
- **Sources:** Whole grains, fruits, vegetables
- **Benefits:** Primary energy source

### Healthy Fats
- **Daily Need:** Include omega-3s daily
- **Sources:** Fish, nuts, seeds, avocado
- **Benefits:** Brain and eye development

## Key Micronutrients

### Folic Acid (Folate)
- **Daily Need:** 600 mcg
- **Critical for:** Neural tube development
- **Sources:** Leafy greens, fortified grains, citrus

### Iron
- **Daily Need:** 27 mg
- **Critical for:** Blood production
- **Sources:** Red meat, spinach, fortified cereals

### Calcium
- **Daily Need:** 1000 mg
- **Critical for:** Bone and teeth development
- **Sources:** Dairy, fortified plant milk, leafy greens

### Vitamin D
- **Daily Need:** 600 IU
- **Critical for:** Calcium absorption, immune function
- **Sources:** Sunlight, fortified dairy, fatty fish

## Hydration

Drink 8-10 glasses of water daily. Proper hydration helps:
- Prevent constipation
- Reduce swelling
- Support increased blood volume
- Maintain amniotic fluid levels

Remember: Every pregnancy is unique. Consult your healthcare provider for personalized nutrition advice.`,
      estimatedReadTime: 20,
    },
  });

  await prisma.videoLesson.create({
    data: {
      lessonId: course3Lessons[2].id,
      videoId: videos[3].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: course3Lessons[2].id,
      textContent:
        "<p>Join us for a practical workshop on creating healthy, balanced meal plans that support your pregnancy.</p>",
    },
  });

  await prisma.lessonAttachment.create({
    data: {
      lessonId: course3Lessons[2].id,
      title: "Weekly Meal Planner Template",
      fileUrl: "https://example.com/attachments/meal-planner.pdf",
      fileName: "weekly-meal-planner.pdf",
      fileSize: 245760, // 240 KB
      mimeType: "application/pdf",
      type: "pdf",
      sequence: 1,
    },
  });

  console.log(`✅ Created ${course3Lessons.length} lessons for Course 3`);

  // 9. Create Modules and Lessons for Course 4 (Lactation)
  console.log("📖 Creating modules and lessons for Course 4...");

  const course4Module1 = await prisma.module.create({
    data: {
      courseId: courses[3].id,
      title: "Lactation Nutrition Basics",
      slug: "lactation-nutrition-basics",
      description: "Fundamental nutrition for breastfeeding mothers",
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
        title: "Nutrition for Milk Production",
        slug: "nutrition-milk-production",
        type: "video",
        description: "Foods and nutrients that support healthy milk supply",
        sequence: 1,
        duration: 12,
        isFree: true,
        status: "published",
      },
    }),
    prisma.lesson.create({
      data: {
        courseId: courses[3].id,
        moduleId: course4Module1.id,
        title: "Hydration and Breastfeeding",
        slug: "hydration-breastfeeding",
        type: "text",
        description: "The importance of staying hydrated while nursing",
        sequence: 2,
        duration: 10,
        isFree: false,
        status: "published",
      },
    }),
  ]);

  await prisma.videoLesson.create({
    data: {
      lessonId: course4Lessons[0].id,
      videoId: videos[3].id,
    },
  });

  await prisma.lessonDescription.create({
    data: {
      lessonId: course4Lessons[0].id,
      textContent:
        "<p>Discover the best foods to support healthy milk production and meet your baby's nutritional needs.</p>",
    },
  });

  await prisma.textLesson.create({
    data: {
      lessonId: course4Lessons[1].id,
      content: `# Hydration and Breastfeeding

## Why Hydration Matters

Breast milk is about 88% water, making proper hydration crucial for milk production and your overall health.

## Daily Water Needs

- **Minimum:** 8-10 glasses (2-2.5 liters)
- **Recommended:** 12-13 glasses (3+ liters)
- **Listen to your body:** Drink when thirsty

## Signs of Good Hydration

✓ Light yellow urine
✓ Regular urination
✓ Moist lips and mouth
✓ Adequate milk supply

## Hydration Tips

1. **Keep water nearby:** Have a water bottle within reach during nursing sessions
2. **Set reminders:** Use phone alerts to remember to drink
3. **Vary your fluids:** Include herbal teas, coconut water, fresh juices
4. **Eat water-rich foods:** Cucumbers, watermelon, oranges, soups

## What to Limit

- Caffeine (max 2-3 cups coffee/day)
- Sugary drinks
- Alcohol (wait 2-3 hours after drinking before nursing)

## Electrolyte Balance

During breastfeeding, you also lose electrolytes. Include:
- Coconut water (natural electrolytes)
- Bananas (potassium)
- Yogurt (calcium, sodium)
- Nuts (magnesium)

Remember: Your hydration directly impacts your milk supply. Make it a priority!`,
      estimatedReadTime: 10,
    },
  });

  console.log(`✅ Created ${course4Lessons.length} lessons for Course 4`);

  // 10. Create Course Reviews
  console.log("⭐ Creating course reviews...");
  const reviews = await Promise.all([
    // Reviews for Course 1
    prisma.courseReview.create({
      data: {
        courseId: courses[0].id,
        userId: users[3].id, // Neha Gupta
        rating: 5,
        review:
          "Absolutely loved this course! Dr. Priya's teaching style is so calming and easy to follow. The prenatal yoga practices helped me throughout my pregnancy and made me feel more prepared for childbirth.",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[0].id,
        userId: users[4].id, // Ritu Singh
        rating: 5,
        review:
          "बहुत अच्छा कोर्स है। हर exercise को बहुत अच्छे से समझाया गया है। Pregnancy के दौरान बहुत help मिली।",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[0].id,
        userId: users[5].id, // Kavita Reddy
        rating: 4,
        review:
          "Great course with comprehensive content. The breathing techniques were especially helpful during labor. Would have loved more third-trimester specific content.",
      },
    }),

    // Reviews for Course 2
    prisma.courseReview.create({
      data: {
        courseId: courses[1].id,
        userId: users[3].id,
        rating: 5,
        review:
          "Perfect for new moms! The exercises are gentle yet effective. I started feeling stronger within 3 weeks. Dr. Priya really understands the postnatal body.",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[1].id,
        userId: users[4].id,
        rating: 5,
        review:
          "Delivery के बाद यह course मेरे लिए बहुत helpful रहा। Core strength वापस आ रही है और back pain भी कम हो गया।",
      },
    }),

    // Reviews for Course 3
    prisma.courseReview.create({
      data: {
        courseId: courses[2].id,
        userId: users[3].id,
        rating: 4,
        review:
          "Very informative course! Anjali explains everything clearly. The meal planning section was particularly useful. My only wish is for more Indian recipe examples.",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[2].id,
        userId: users[5].id,
        rating: 5,
        review:
          "This course transformed how I eat during pregnancy. I feel healthier, more energetic, and my doctor is happy with my nutrition choices. Highly recommend!",
      },
    }),

    // Reviews for Course 4
    prisma.courseReview.create({
      data: {
        courseId: courses[3].id,
        userId: users[4].id,
        rating: 5,
        review:
          "Breastfeeding journey के लिए perfect guidance। Foods for milk supply की information बहुत useful थी। Thank you Anjali!",
      },
    }),
    prisma.courseReview.create({
      data: {
        courseId: courses[3].id,
        userId: users[5].id,
        rating: 5,
        review:
          "As a first-time mom, this course gave me so much confidence about nutrition while breastfeeding. Clear, practical advice that actually works!",
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
  console.log(`   🎬 Videos: ${videos.length}`);
  console.log(`   📚 Courses: ${courses.length}`);
  console.log(`   📖 Modules: 7`);
  console.log(
    `   📄 Lessons: ${
      course1Lessons.length + course2Lessons.length + course3Lessons.length + course4Lessons.length
    }`
  );
  console.log(`   ⭐ Reviews: ${reviews.length}`);
  console.log(`   📊 Progress Records: ${courseProgress.length + lessonProgress.length}`);
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
